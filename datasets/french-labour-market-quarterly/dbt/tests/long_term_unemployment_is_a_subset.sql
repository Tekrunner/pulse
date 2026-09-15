-- Long-term unemployed people are unemployed people who have been searching for
-- a year or more, so their count can never exceed the total, and their rate can
-- never exceed the headline rate.
select period, long_term_unemployed_thousands, unemployed_thousands
from {{ ref('french_labour_market_quarterly') }}
where long_term_unemployed_thousands > unemployed_thousands
   or long_term_unemployment_rate_pct > unemployment_rate_pct
