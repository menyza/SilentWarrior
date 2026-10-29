CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY,
 display_name TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_credentials (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 public_key TEXT NOT NULL,
 counter INTEGER NOT NULL DEFAULT 0,
 transports TEXT NOT NULL DEFAULT '[]',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_credentials_user ON account_credentials(user_id);
CREATE TABLE IF NOT EXISTS account_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessions_user ON account_sessions(user_id);
CREATE TABLE IF NOT EXISTS account_challenges (
 id TEXT PRIMARY KEY,
 challenge TEXT NOT NULL,
 kind TEXT NOT NULL,
 user_id TEXT,
 display_name TEXT,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_documents (
 user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0,
 data TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_rate_limits (
 bucket TEXT PRIMARY KEY,
 count INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_document_history (
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 data TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,revision)
);
CREATE TRIGGER IF NOT EXISTS account_document_backup BEFORE UPDATE ON account_documents
WHEN OLD.revision > 0 AND OLD.data != 'null'
BEGIN
 INSERT OR IGNORE INTO account_document_history(user_id,revision,data,created_at) VALUES (OLD.user_id,OLD.revision,OLD.data,OLD.updated_at);
 DELETE FROM account_document_history WHERE user_id=OLD.user_id AND revision < OLD.revision-9;
END;
