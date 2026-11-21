-- orders in the first week of October
SELECT *
FROM orders
WHERE strftime('%Y-%m-%d', order_date) BETWEEN '2026-10-01' AND '2026-10-07';
