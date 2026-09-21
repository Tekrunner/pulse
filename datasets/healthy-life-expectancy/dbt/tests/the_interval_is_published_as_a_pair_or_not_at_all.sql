-- A half-open interval would let a consumer draw a band with one edge missing.
select period, location_code, sex, uncertainty_low_years, uncertainty_high_years
from {{ ref('healthy_life_expectancy') }}
where (uncertainty_low_years is null) <> (uncertainty_high_years is null)
