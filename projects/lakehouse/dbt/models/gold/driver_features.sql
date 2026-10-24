-- GOLD (ML features): one row per driver, the kind of table a model or an LLM agent reads.
select
  driver_id,
  count(*)                                         as trips_30d,
  count_if(status = 'completed')                   as completed_30d,
  round(avg(case when status = 'completed' then fare_inr end), 2) as avg_fare_inr,
  round(avg(distance_km), 2)                       as avg_km,
  count(distinct city)                             as cities_served,
  max(pickup_ts)                                   as last_trip_ts
from {{ source('silver', 'trips') }}
where driver_id is not null
group by 1
