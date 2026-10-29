-- Add account ownership without changing existing devices, tokens or schedules.
CREATE TABLE IF NOT EXISTS subscription_owners (
 subscription_id TEXT PRIMARY KEY REFERENCES subscriptions(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS subscription_owners_user ON subscription_owners(user_id);
