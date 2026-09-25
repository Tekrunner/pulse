-- INSEE publishes contributions that add up to GDP volume growth: final
-- consumption, fixed capital formation, inventories, valuables and net trade.
-- Each is rounded to three decimals, so five of them may miss by 0.0025 each.
select period, gdp_volume_growth_pct,
  contribution_final_consumption_pt + contribution_gfcf_pt + contribution_inventories_pt
    + contribution_valuables_pt + contribution_net_trade_pt as summed_pt
from {{ ref('french_national_accounts_annual') }}
where gdp_volume_growth_pct is not null
  and abs(gdp_volume_growth_pct - (
    contribution_final_consumption_pt + contribution_gfcf_pt + contribution_inventories_pt
    + contribution_valuables_pt + contribution_net_trade_pt)) > 0.0125
