{#
  The provider series behind each published column, named by their dimensions.
  Shared by the selection model and by the test that each selector matches
  exactly one provider series.
#}
{% macro series_selectors() %}
{% set gdp = "INDICATEUR like 'CNA_%' and CNA_PRODUIT is not null" %}
{% set total_economy = "CNA_ACTIVITE = 'NNTOTAL' and CNA_TYPE_EMP is null" %}
{% set employment = "CNA_ACTIVITE = 'NNTOTAL' and CNA_TYPE_EMP is not null and \"SECT-INST\" = 'S10'" %}
{% do return({
  'gdp_current_eur_mn':                    gdp ~ " and OPERATION = 'PIB' and PRIX_REF = 'VAL'",
  'gdp_chained_2020_eur_mn':               gdp ~ " and OPERATION = 'PIB' and PRIX_REF = 'PCH'",
  'gdp_price_index_2020':                  gdp ~ " and OPERATION = 'PIB' and PRIX_REF = 'IPCH'",
  'gdp_volume_growth_pct':                 gdp ~ " and OPERATION = 'PIB' and PRIX_REF = 'CONTPIB'",
  'gdp_per_capita_current_eur':            gdp ~ " and OPERATION = 'PIB_H' and PRIX_REF = 'VAL'",
  'gdp_per_capita_chained_2020_eur':       gdp ~ " and OPERATION = 'PIB_H' and PRIX_REF = 'PCH'",
  'contribution_final_consumption_pt':     gdp ~ " and OPERATION = 'P3' and \"SECT-INST\" = 'S0'",
  'contribution_household_consumption_pt': gdp ~ " and OPERATION = 'P3' and \"SECT-INST\" = 'S14B'",
  'contribution_npish_consumption_pt':     gdp ~ " and OPERATION = 'P3' and \"SECT-INST\" = 'S15'",
  'contribution_government_consumption_pt': gdp ~ " and OPERATION = 'P3' and \"SECT-INST\" = 'S13'",
  'contribution_gfcf_pt':                  gdp ~ " and OPERATION = 'P51G' and \"SECT-INST\" = 'S0'",
  'contribution_gfcf_non_financial_corporations_pt': gdp ~ " and OPERATION = 'P51G' and \"SECT-INST\" = 'S11ES14AA'",
  'contribution_gfcf_financial_corporations_pt': gdp ~ " and OPERATION = 'P51G' and \"SECT-INST\" = 'S12ES14AF'",
  'contribution_gfcf_households_pt':       gdp ~ " and OPERATION = 'P51G' and \"SECT-INST\" = 'S14B'",
  'contribution_gfcf_government_pt':       gdp ~ " and OPERATION = 'P51G' and \"SECT-INST\" = 'S13'",
  'contribution_gfcf_npish_pt':            gdp ~ " and OPERATION = 'P51G' and \"SECT-INST\" = 'S15'",
  'contribution_inventories_pt':           gdp ~ " and OPERATION = 'P52'",
  'contribution_valuables_pt':             gdp ~ " and OPERATION = 'P53'",
  'contribution_exports_pt':               gdp ~ " and OPERATION = 'P6'",
  'contribution_imports_pt':               gdp ~ " and OPERATION = 'P7'",
  'contribution_net_trade_pt':             gdp ~ " and OPERATION = 'B11'",
  'gross_value_added_eur_mn':              total_economy ~ " and OPERATION = 'B1G' and PRIX_REF = 'VAL'",
  'compensation_of_employees_eur_mn':      total_economy ~ " and OPERATION = 'D1'",
  'wages_and_salaries_eur_mn':             total_economy ~ " and OPERATION = 'D11'",
  'gross_operating_surplus_eur_mn':        total_economy ~ " and OPERATION = 'B2G'",
  'operating_surplus_and_mixed_income_eur_mn': total_economy ~ " and OPERATION = 'B2GEB3G'",
  'employment_thousands':                  employment ~ " and CNA_TYPE_EMP = 'E10' and UNIT_MEASURE = 'MILLIERS_ACTIFS_OCCUPES_PP'",
  'employees_thousands':                   employment ~ " and CNA_TYPE_EMP = 'E20' and UNIT_MEASURE = 'MILLIERS_ACTIFS_OCCUPES_PP'",
  'non_employees_thousands':               employment ~ " and CNA_TYPE_EMP = 'E30' and UNIT_MEASURE = 'MILLIERS_ACTIFS_OCCUPES_PP'",
  'hours_worked':                          employment ~ " and CNA_TYPE_EMP = 'E10' and INDICATEUR = 'CNA_VOLUME_HEURES_TRAV'"
}) %}
{% endmacro %}
