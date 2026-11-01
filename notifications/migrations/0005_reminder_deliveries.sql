CREATE TABLE IF NOT EXISTS reminder_deliveries (
 subscription_id TEXT NOT NULL,
 reminder_id TEXT NOT NULL,
 local_date TEXT NOT NULL,
 claim TEXT NOT NULL,
 PRIMARY KEY(subscription_id, reminder_id, local_date)
);
