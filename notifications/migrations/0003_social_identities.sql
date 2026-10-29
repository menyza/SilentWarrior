-- Created automatically by account-schema.js as well, for existing deployments.
CREATE TABLE IF NOT EXISTS account_social_identities (
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 provider TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(issuer,subject)
);
