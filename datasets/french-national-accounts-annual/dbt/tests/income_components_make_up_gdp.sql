-- The income-side components are built so that they close on GDP: published
-- compensation, surplus and mixed income, and the two net-tax residuals. This
-- asserts the derivation, and that the AMECO adjustment moves income between
-- labour and capital without creating or losing any. Each column is rounded
-- to a tenth of a million euros.
select period
from {{ ref('french_national_accounts_annual') }}
where abs(gdp_current_eur_mn - (compensation_of_employees_eur_mn + gross_operating_surplus_eur_mn
    + gross_mixed_income_eur_mn + net_taxes_on_production_eur_mn + net_taxes_on_products_eur_mn)) > 0.3
   or abs(gdp_current_eur_mn - (adjusted_labour_income_eur_mn + adjusted_capital_income_eur_mn
    + net_taxes_on_production_eur_mn + net_taxes_on_products_eur_mn)) > 0.3
