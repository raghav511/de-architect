-- GOLD (LLM context): one plain-English line per city and day. An assistant can retrieve these
-- instead of scanning raw tables, which keeps answers grounded in governed numbers.
select
  trip_date,
  city,
  'On ' || cast(trip_date as varchar) || ', ' || city || ' had ' || cast(completed as varchar) || ' completed trips out of '
    || cast(trips as varchar) || ' (' || cast(cancel_rate_pct as varchar) || '% cancelled) and earned INR '
    || cast(revenue_inr as varchar) || '.' as context_text
from {{ ref('daily_city_metrics') }}
