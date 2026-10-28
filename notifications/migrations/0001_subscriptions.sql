CREATE TABLE IF NOT EXISTS subscriptions (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 endpoint TEXT NOT NULL UNIQUE,
 p256dh TEXT NOT NULL,
 auth TEXT NOT NULL,
 settings TEXT NOT NULL,
 last_morning TEXT,
 last_evening TEXT,
 last_test INTEGER NOT NULL DEFAULT 0
);
