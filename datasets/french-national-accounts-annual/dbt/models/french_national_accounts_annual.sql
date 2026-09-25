{#
  One wide row per year of the French annual national accounts, base 2020,
  pivoted from the snapshot's long series/observation shape.

  Series are selected by their provider dimensions rather than by IDBANK: the
  snapshot carries every dataflow whole, so the dimensions say what a series is,
  and a selection that names them reads as the definition it is. The selectors
  live in `macros/series_selectors.sql`; `every_selector_matches_one_series`
  fails the build unless each matches exactly one provider series.

  Four columns are derived here, each an accounting identity over published
  aggregates rather than an estimate:
  - gross mixed income = (operating surplus + mixed income) - operating surplus;
  - net taxes on production = value added - compensation - (surplus + mixed income),
    i.e. other taxes less other subsidies on production;
  - net taxes on products = GDP - value added;
  - the AMECO-adjusted labour income credits each non-employee with the average
    compensation per employee, and the adjusted capital income is what is left of
    operating surplus and mixed income. AMECO scales compensation by total
    employment over employees; the provider rounds the three counts separately,
    so employees plus non-employees is used instead, which makes the adjusted
    split close on GDP exactly rather than within a rounding of the counts.
#}

{% set selectors = series_selectors() %}

with pivoted as (
  select
    period,
    {%- for column in selectors %}
    max(case when series = '{{ column }}' then value end) as {{ column }}{{ "," if not loop.last }}
    {%- endfor %}
  from {{ ref('french_national_accounts_annual_series') }}
  group by period
)
select
  period,
  cast(gdp_current_eur_mn as decimal(18, 1)) as gdp_current_eur_mn,
  cast(gdp_chained_2020_eur_mn as decimal(18, 1)) as gdp_chained_2020_eur_mn,
  cast(gdp_price_index_2020 as decimal(12, 3)) as gdp_price_index_2020,
  cast(gdp_volume_growth_pct as decimal(8, 3)) as gdp_volume_growth_pct,
  cast(gdp_per_capita_current_eur as decimal(12, 0)) as gdp_per_capita_current_eur,
  cast(gdp_per_capita_chained_2020_eur as decimal(12, 0)) as gdp_per_capita_chained_2020_eur,
  {%- for column in selectors if column.startswith('contribution_') %}
  cast({{ column }} as decimal(8, 3)) as {{ column }},
  {%- endfor %}
  cast(gross_value_added_eur_mn as decimal(18, 1)) as gross_value_added_eur_mn,
  cast(compensation_of_employees_eur_mn as decimal(18, 1)) as compensation_of_employees_eur_mn,
  cast(wages_and_salaries_eur_mn as decimal(18, 1)) as wages_and_salaries_eur_mn,
  cast(gross_operating_surplus_eur_mn as decimal(18, 1)) as gross_operating_surplus_eur_mn,
  cast(operating_surplus_and_mixed_income_eur_mn - gross_operating_surplus_eur_mn as decimal(18, 1)) as gross_mixed_income_eur_mn,
  cast(gross_value_added_eur_mn - compensation_of_employees_eur_mn - operating_surplus_and_mixed_income_eur_mn as decimal(18, 1)) as net_taxes_on_production_eur_mn,
  cast(gdp_current_eur_mn - gross_value_added_eur_mn as decimal(18, 1)) as net_taxes_on_products_eur_mn,
  cast(employment_thousands as decimal(10, 1)) as employment_thousands,
  cast(employees_thousands as decimal(10, 1)) as employees_thousands,
  cast(non_employees_thousands as decimal(10, 1)) as non_employees_thousands,
  cast(hours_worked / 1e6 as decimal(12, 1)) as hours_worked_mn,
  cast(compensation_of_employees_eur_mn / employees_thousands * non_employees_thousands as decimal(18, 1)) as imputed_non_employee_labour_income_eur_mn,
  cast(compensation_of_employees_eur_mn * (1 + non_employees_thousands / employees_thousands) as decimal(18, 1)) as adjusted_labour_income_eur_mn,
  cast(operating_surplus_and_mixed_income_eur_mn - compensation_of_employees_eur_mn / employees_thousands * non_employees_thousands as decimal(18, 1)) as adjusted_capital_income_eur_mn,
  cast(100 * compensation_of_employees_eur_mn * (1 + non_employees_thousands / employees_thousands) / gdp_current_eur_mn as decimal(8, 2)) as adjusted_wage_share_pct,
  cast(100 * compensation_of_employees_eur_mn / gdp_current_eur_mn as decimal(8, 2)) as unadjusted_wage_share_pct
from pivoted
order by period
