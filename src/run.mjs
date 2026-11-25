import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createPilot, createEventDesk } from './pilot.mjs';
import { base58Encode } from './wallet-proof.mjs';

// All wallets are generated for this run and discarded with the process.
function testWallet() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const bytes = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return {
    address: base58Encode(bytes),
    approve: text => sign(null, Buffer.from(text, 'utf8'), privateKey).toString('base64')
  };
}

let timestamp = Date.UTC(2026, 10, 23, 17);
const clock = () => timestamp;
const id = createPilot(clock);
const desk = createEventDesk(clock);
const checks = [];
const check = (name, run) => { run(); checks.push(name); };
function logIn(wallet) {
  const proof = id.challenge(wallet.address);
  return id.finish(proof.nonce, wallet.approve(proof.message)).session;
}

try {
  const first = testWallet();
  const second = testWallet();
  const account = logIn(first);
  const event = 'Field Notes Night';
  let greenhouse, organizer, secondSession;

  check('The member can approve a display name for the Greenhouse.', () => {
    id.setHandle(account, 'Fieldkeeper');
    id.allow(account, 'greenhouse', { shareHandle: true });
    greenhouse = id.fields(account, 'greenhouse');
    assert.equal(greenhouse.preferred_username, 'Fieldkeeper');
    assert.deepEqual(Object.keys(greenhouse).sort(), ['iss', 'preferred_username', 'sub']);
  });
  check('The event organizer receives a distinct member number only after consent.', () => {
    assert.throws(() => id.fields(account, 'event-desk'), /consent/);
    assert.throws(() => id.allow(account, 'event-desk', { shareHandle: true }), /permissions/);
    id.allow(account, 'event-desk');
    organizer = id.fields(account, 'event-desk');
    assert.deepEqual(Object.keys(organizer).sort(), ['iss', 'sub']);
    assert.notEqual(organizer.sub, greenhouse.sub);
  });
  check('The second wallet gives fresh proof and reopens both existing app profiles.', () => {
    const addition = id.challenge(second.address, 'link', account);
    assert.deepEqual(id.finish(addition.nonce, second.approve(addition.message), account), { linked: true });
    secondSession = logIn(second);
    assert.deepEqual(id.fields(secondSession, 'greenhouse'), greenhouse);
    assert.deepEqual(id.fields(secondSession, 'event-desk'), organizer);
  });
  check('A reviewed Greenhouse crew badge crosses to the venue only with permission.', () => {
    id.allow(account, 'event-desk', { shareCrew: true });
    assert.deepEqual(id.fields(account, 'event-desk'), organizer);
    id.allow(account, 'event-desk');
    id.moderatorFixture.recordCrewReview(greenhouse.sub, 'sample-caption-review', clock() + 5000);
    assert.deepEqual(id.fields(secondSession, 'event-desk'), organizer);
    id.allow(secondSession, 'event-desk', { shareCrew: true });
    assert.deepEqual(id.fields(account, 'event-desk'), { ...organizer, potify_crew: true });
    timestamp += 5001;
    assert.deepEqual(id.fields(account, 'event-desk'), organizer);
    id.allow(account, 'event-desk');
  });
  check('The member checks in once using a short-lived pass issued by the event desk.', () => {
    assert.throws(() => desk.issuePass(event, organizer), /RSVP/);
    desk.register(event, organizer);
    const pass = desk.issuePass(event, id.fields(secondSession, 'event-desk'));
    assert.equal(desk.redeem('Different event', pass), false);
    assert.equal(desk.redeem(event, pass), true);
    assert.equal(desk.redeem(event, pass), false);
    assert.throws(() => desk.issuePass(event, organizer), /RSVP/);
  });
  check('Revoking event access blocks new identity releases while the Greenhouse still works.', () => {
    id.revoke(secondSession, 'event-desk');
    assert.throws(() => id.fields(account, 'event-desk'), /consent/);
    assert.deepEqual(id.fields(secondSession, 'greenhouse'), greenhouse);
    id.allow(account, 'event-desk');
    assert.deepEqual(id.fields(account, 'event-desk'), organizer);
  });
  check('Reused and expired sign-in challenges fail. A third wallet retains its own account.', () => {
    const proof = id.challenge(first.address);
    id.finish(proof.nonce, first.approve(proof.message));
    assert.throws(() => id.finish(proof.nonce, first.approve(proof.message)), /already used/);
    const other = testWallet();
    const ownSession = logIn(other);
    const link = id.challenge(other.address, 'link', account);
    assert.throws(() => id.finish(link.nonce, other.approve(link.message), account), /another account/);
    id.allow(ownSession, 'greenhouse');
    assert.notEqual(id.fields(ownSession, 'greenhouse').sub, greenhouse.sub);
    const expiring = id.challenge(second.address);
    timestamp += 300_001;
    assert.throws(() => id.finish(expiring.nonce, second.approve(expiring.message)), /expired/);
    assert.throws(() => id.challenge(other.address, 'link', account), /Fresh/);
  });
  check('An expired event pass cannot check someone in. A replacement pass works.', () => {
    const differentEvent = 'Open Studio';
    desk.register(differentEvent, organizer);
    const firstPass = desk.issuePass(differentEvent, organizer);
    timestamp += 60_001;
    assert.equal(desk.redeem(differentEvent, firstPass), false);
    assert.equal(desk.redeem(differentEvent, desk.issuePass(differentEvent, organizer)), true);
  });

  console.log('POTIFY ID  /  offline account and event pilot');
  checks.forEach((result, index) => console.log((index + 1) + '. PASS  ' + result));
  console.log('Greenhouse member fields: ' + Object.keys(greenhouse).join(', '));
  console.log('Event app member fields: ' + Object.keys(organizer).join(', '));
  console.log('Fixture scope: in-memory databases, disposable signing keys and two app projections. OIDC, device wallets and an external operator need separate live testing.');
} finally {
  desk.close();
  id.close();
}
