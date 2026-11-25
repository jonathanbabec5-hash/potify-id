PRAGMA foreign_keys = ON;
CREATE TABLE member (
  id TEXT PRIMARY KEY,
  handle TEXT
);
CREATE TABLE wallet_link (
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  verified_ms INTEGER NOT NULL,
  PRIMARY KEY (chain, address)
);
CREATE TABLE session (
  digest TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  proved_ms INTEGER NOT NULL,
  expires_ms INTEGER NOT NULL
);
CREATE TABLE challenge (
  nonce TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('sign-in', 'link')),
  session_digest TEXT REFERENCES session(digest) ON DELETE CASCADE,
  message TEXT NOT NULL,
  expires_ms INTEGER NOT NULL,
  CHECK ((purpose = 'link') = (session_digest IS NOT NULL))
);
CREATE TABLE client (
  id TEXT PRIMARY KEY,
  sector TEXT NOT NULL UNIQUE,
  may_request_handle INTEGER NOT NULL CHECK (may_request_handle IN (0, 1)),
  may_request_crew INTEGER NOT NULL CHECK (may_request_crew IN (0, 1))
);
CREATE TABLE subject (
  member_id TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  sector TEXT NOT NULL REFERENCES client(sector),
  value TEXT NOT NULL UNIQUE,
  PRIMARY KEY (member_id, sector)
);
CREATE TABLE consent (
  member_id TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES client(id),
  share_handle INTEGER NOT NULL CHECK (share_handle IN (0, 1)),
  share_crew INTEGER NOT NULL CHECK (share_crew IN (0, 1)),
  granted_ms INTEGER NOT NULL,
  revoked_ms INTEGER,
  PRIMARY KEY (member_id, client_id)
);
CREATE TABLE crew_review (
  member_id TEXT PRIMARY KEY REFERENCES member(id) ON DELETE CASCADE,
  private_receipt TEXT NOT NULL,
  expires_ms INTEGER NOT NULL
);
