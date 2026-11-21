-- revenue per country for the dashboard
SELECT o.country, SUM(o.amount) AS revenue
FROM orders o
JOIN order_items i ON i.order_id = o.order_id
GROUP BY o.country;
