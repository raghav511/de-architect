-- latest version of each order (orders are re-sent with a later updated_at)
SELECT order_id, country, amount
FROM (
  SELECT order_id, country, amount,
         ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn
  FROM orders_raw
) t
WHERE rn = 1;
