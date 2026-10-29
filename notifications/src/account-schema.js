export const accountSchema = [

  "CREATE TABLE IF NOT EXISTS accounts (\n id TEXT PRIMARY KEY,\n display_name TEXT NOT NULL,\n created_at INTEGER NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS account_social_identities (issuer TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, provider TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(issuer,subject))",
  "CREATE TABLE IF NOT EXISTS account_credentials (\n id TEXT PRIMARY KEY,\n user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,\n public_key TEXT NOT NULL,\n counter INTEGER NOT NULL DEFAULT 0,\n transports TEXT NOT NULL DEFAULT '[]',\n created_at INTEGER NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS account_credentials_user ON account_credentials(user_id)",
  "CREATE TABLE IF NOT EXISTS account_sessions (\n token_hash TEXT PRIMARY KEY,\n user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,\n expires_at INTEGER NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS account_sessions_user ON account_sessions(user_id)",
  "CREATE TABLE IF NOT EXISTS account_challenges (\n id TEXT PRIMARY KEY,\n challenge TEXT NOT NULL,\n kind TEXT NOT NULL,\n user_id TEXT,\n display_name TEXT,\n expires_at INTEGER NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS account_documents (\n user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,\n revision INTEGER NOT NULL DEFAULT 0,\n data TEXT NOT NULL,\n updated_at INTEGER NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS account_rate_limits (\n bucket TEXT PRIMARY KEY,\n count INTEGER NOT NULL DEFAULT 0,\n expires_at INTEGER NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS account_document_history (\n user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,\n revision INTEGER NOT NULL,\n data TEXT NOT NULL,\n created_at INTEGER NOT NULL,\n PRIMARY KEY(user_id,revision)\n)",
  "CREATE TRIGGER IF NOT EXISTS account_document_backup BEFORE UPDATE ON account_documents\nWHEN OLD.revision > 0 AND OLD.data != 'null'\nBEGIN\n INSERT OR IGNORE INTO account_document_history(user_id,revision,data,created_at) VALUES (OLD.user_id,OLD.revision,OLD.data,OLD.updated_at);\n DELETE FROM account_document_history WHERE user_id=OLD.user_id AND revision < OLD.revision-9;\nEND;"
];
