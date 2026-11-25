import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { base58Decode, base58Encode, verifySolanaMessage } from './wallet-proof.mjs';

// A local model of the member store behind a future OIDC provider. No HTTP listener.
const issuer = 'https://id.potify.example';
const chain = 'solana';
const challengeMs = 5 * 60 * 1000;
const sessionMs = 60 * 60 * 1000;
const random = () => randomBytes(32).toString('hex');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };

function atomic(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createPilot(clock = Date.now) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./persona.sql', import.meta.url), 'utf8'));
  // Distinct registered sectors. Each receives its own persistent subject.
  const register = db.prepare('INSERT INTO client VALUES (?, ?, ?, ?)');
  register.run('greenhouse', 'greenhouse.example', 1, 0);
  register.run('event-desk', 'events.example', 0, 1);

  function session(token) {
    requireThat(typeof token === 'string', 'Sign in first');
    const record = db.prepare('SELECT * FROM session WHERE digest=? AND expires_ms>?').get(hash(token), clock());
    requireThat(record, 'Session expired or unknown');
    return record;
  }

  function challenge(address, purpose = 'sign-in', token) {
    const bytes = base58Decode(address);
    requireThat(bytes.length === 32 && base58Encode(bytes) === address, 'Invalid wallet address');
    requireThat(purpose === 'sign-in' || purpose === 'link', 'Unknown purpose');
    const current = purpose === 'link' ? session(token) : null;
    const now = clock();
    if (current) requireThat(now - current.proved_ms < challengeMs, 'Fresh account sign-in required');
    const nonce = random();
    const expires = now + challengeMs;
    const statement = current ? 'Link this wallet to the Potify ID account you just authenticated.' : 'Sign in to your Potify ID test account.';
    const message = [
      'id.potify.example wants you to sign in with your Solana account:', address, '', statement, '',
      'URI: ' + issuer + '/account', 'Version: 1', 'Nonce: ' + nonce,
      'Issued At: ' + new Date(now).toISOString(), 'Expiration Time: ' + new Date(expires).toISOString()
    ].join('\n');
    db.prepare('INSERT INTO challenge VALUES (?, ?, ?, ?, ?, ?)').run(nonce, address, purpose, current?.digest ?? null, message, expires);
    return { nonce, message };
  }

  function finish(nonce, signature, token) {
    return atomic(db, () => {
      const now = clock();
      const row = db.prepare('SELECT * FROM challenge WHERE nonce=? AND expires_ms>?').get(nonce, now);
      requireThat(row, 'Challenge expired or already used');
      requireThat(verifySolanaMessage(row.address, row.message, signature), 'Wallet proof did not verify');
      const linked = db.prepare('SELECT member_id FROM wallet_link WHERE chain=? AND address=?').get(chain, row.address);
      let memberID;
      if (row.purpose === 'link') {
        const current = session(token);
        requireThat(current.digest === row.session_digest && now - current.proved_ms < challengeMs, 'Link requires the initiating recent session');
        requireThat(!linked || linked.member_id === current.member_id, 'Wallet already belongs to another account');
        memberID = current.member_id;
      } else {
        memberID = linked?.member_id ?? randomUUID();
        if (!linked) db.prepare('INSERT INTO member(id) VALUES (?)').run(memberID);
      }
      if (!linked) db.prepare('INSERT INTO wallet_link VALUES (?, ?, ?, ?)').run(chain, row.address, memberID, now);
      db.prepare('DELETE FROM challenge WHERE nonce=?').run(nonce);
      if (row.purpose === 'link') return { linked: true };
      const ticket = random();
      db.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run(hash(ticket), memberID, now, now + sessionMs);
      return { session: ticket };
    });
  }

  function setHandle(token, handle) {
    requireThat(typeof handle === 'string' && /^[\p{L}\p{N} _.-]{1,32}$/u.test(handle), 'Choose a short display name');
    db.prepare('UPDATE member SET handle=? WHERE id=?').run(handle, session(token).member_id);
  }

  function allow(token, clientID, { shareHandle = false, shareCrew = false } = {}) {
    const member = session(token).member_id;
    const client = db.prepare('SELECT * FROM client WHERE id=?').get(clientID);
    requireThat(client && (!shareHandle || client.may_request_handle) && (!shareCrew || client.may_request_crew), 'Field outside the registered permissions');
    atomic(db, () => {
      db.prepare('INSERT INTO subject VALUES (?, ?, ?) ON CONFLICT (member_id, sector) DO NOTHING')
        .run(member, client.sector, random());
      db.prepare('INSERT INTO consent VALUES (?, ?, ?, ?, ?, NULL) ON CONFLICT (member_id, client_id) DO UPDATE SET share_handle=excluded.share_handle, share_crew=excluded.share_crew, granted_ms=excluded.granted_ms, revoked_ms=NULL')
        .run(member, clientID, shareHandle ? 1 : 0, shareCrew ? 1 : 0, clock());
    });
  }

  // A provider-side projection. In production only a validated OIDC client flow
  // may receive it. The session handle and database remain inside the issuer.
  function fields(token, clientID) {
    const member = session(token).member_id;
    const row = db.prepare(
      'SELECT s.value, c.share_handle, c.share_crew, m.handle FROM consent c JOIN client a ON a.id=c.client_id ' +
      'JOIN subject s ON s.member_id=c.member_id AND s.sector=a.sector JOIN member m ON m.id=c.member_id ' +
      'WHERE c.member_id=? AND c.client_id=? AND c.revoked_ms IS NULL'
    ).get(member, clientID);
    requireThat(row, 'New consent required');
    const result = { iss: issuer, sub: row.value };
    if (row.share_handle && row.handle) result.preferred_username = row.handle;
    if (row.share_crew && db.prepare('SELECT 1 FROM crew_review WHERE member_id=? AND expires_ms>?').get(member, clock())) {
      result.potify_crew = true;
    }
    return result;
  }

  function revoke(token, clientID) {
    db.prepare('UPDATE consent SET revoked_ms=? WHERE member_id=? AND client_id=? AND revoked_ms IS NULL')
      .run(clock(), session(token).member_id, clientID);
  }
  // Privileged fixture input representing a moderator's verified receipt. It is
  // outside all member and partner interfaces. A real importer authenticates its author.
  function recordCrewReview(greenhouseSubject, privateReceipt, expiresMs) {
    const entry = db.prepare("SELECT member_id FROM subject WHERE sector='greenhouse.example' AND value=?").get(greenhouseSubject);
    requireThat(entry && privateReceipt && expiresMs > clock(), 'A completed moderator review and future expiry are required');
    db.prepare('INSERT INTO crew_review VALUES (?, ?, ?) ON CONFLICT (member_id) DO UPDATE SET private_receipt=excluded.private_receipt, expires_ms=excluded.expires_ms')
      .run(entry.member_id, privateReceipt, expiresMs);
  }
  return { challenge, finish, setHandle, allow, fields, revoke, moderatorFixture: { recordCrewReview }, close: () => db.close() };
}

// A separate event application owns the booking and the attendance record.
// Local input to issuePass represents already authenticated application state.
// A deployed app obtains it from its validated OIDC callback, never from QR data.
export function createEventDesk(clock = Date.now) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE rsvp(event TEXT, issuer TEXT, subject TEXT, pass_hash TEXT UNIQUE, expires_ms INTEGER, used_ms INTEGER, PRIMARY KEY (event, issuer, subject))');
  function register(event, { iss, sub }) {
    db.prepare('INSERT INTO rsvp(event, issuer, subject) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(event, iss, sub);
  }
  function issuePass(event, { iss, sub }) {
    const pass = random();
    const change = db.prepare('UPDATE rsvp SET pass_hash=?, expires_ms=? WHERE event=? AND issuer=? AND subject=? AND used_ms IS NULL')
      .run(hash(pass), clock() + 60_000, event, iss, sub);
    requireThat(change.changes === 1, 'An unused RSVP is required');
    return pass;
  }
  function redeem(event, pass) {
    const now = clock();
    const change = db.prepare('UPDATE rsvp SET used_ms=? WHERE event=? AND pass_hash=? AND expires_ms>? AND used_ms IS NULL')
      .run(now, event, hash(pass), now);
    return change.changes === 1;
  }
  return { register, issuePass, redeem, close: () => db.close() };
}
