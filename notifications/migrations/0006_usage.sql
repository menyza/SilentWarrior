CREATE TABLE IF NOT EXISTS usage_sessions (
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL,
 active_ms INTEGER NOT NULL DEFAULT 0,
 received_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,session_id)
);
CREATE INDEX IF NOT EXISTS usage_sessions_user_time ON usage_sessions(user_id,started_at);
