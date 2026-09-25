-- Each published column is fed by exactly one provider series. A selector that
-- matches none has lost its series; one that matches two would silently take
-- the larger value in the pivot.
{% set selectors = series_selectors() %}
with expected as (
  select unnest([{% for column in selectors %}'{{ column }}'{{ ", " if not loop.last }}{% endfor %}]) as series
),
matched as (
  select series, count(distinct idbank) as series_count
  from {{ ref('french_national_accounts_annual_series') }}
  group by series
)
select expected.series, coalesce(matched.series_count, 0) as series_count
from expected
left join matched using (series)
where coalesce(matched.series_count, 0) <> 1
