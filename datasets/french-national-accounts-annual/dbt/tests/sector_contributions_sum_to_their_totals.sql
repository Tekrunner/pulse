-- Households, non-profit institutions and government partition final
-- consumption; the five investing sectors partition fixed capital formation;
-- exports and imports make up net trade. Each contribution is rounded to three
-- decimals, so the tolerance allows half a unit of the last digit per term.
select period, 'final consumption' as total
from {{ ref('french_national_accounts_annual') }}
where abs(contribution_final_consumption_pt - (contribution_household_consumption_pt
  + contribution_npish_consumption_pt + contribution_government_consumption_pt)) > 0.002
union all
select period, 'fixed capital formation'
from {{ ref('french_national_accounts_annual') }}
where abs(contribution_gfcf_pt - (contribution_gfcf_non_financial_corporations_pt
  + contribution_gfcf_financial_corporations_pt + contribution_gfcf_households_pt
  + contribution_gfcf_government_pt + contribution_gfcf_npish_pt)) > 0.003
union all
select period, 'net trade'
from {{ ref('french_national_accounts_annual') }}
where abs(contribution_net_trade_pt - (contribution_exports_pt + contribution_imports_pt)) > 0.0015
