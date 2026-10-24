-- GOLD (metrics): one row per day and city. Feeds dashboards and the text-to-SQL project later.
select
  trip_date,
  city,
  count(*)                                                    as trips,
  count_if(status = 'completed')                              as completed,
  count_if(status = 'cancelled')                              as cancelled,
  round(100.0 * count_if(status = 'cancelled') / count(*), 2) as cancel_rate_pct,
  round(sum(case when status = 'completed' then fare_inr end), 2) as revenue_inr,
  count(distinct rider_id)                                    as active_riders
from {{ source('silver', 'trips') }}
group by 1, 2
