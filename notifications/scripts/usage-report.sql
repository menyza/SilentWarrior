-- Read-only administrative usage report. Timestamps are UTC; convert for display.
SELECT a.display_name,
       COUNT(u.session_id) AS entries,
       ROUND(COALESCE(SUM(u.active_ms),0)/60000.0,1) AS active_minutes,
       datetime(MAX(u.last_seen_at)/1000,'unixepoch') AS latest_usage_utc
FROM accounts a LEFT JOIN usage_sessions u ON u.user_id=a.id
GROUP BY a.id,a.display_name
ORDER BY active_minutes DESC;
