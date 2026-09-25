-- Employees and non-employees partition domestic employment. Each count is
-- published to a tenth of a thousand, so the sum may miss by 0.1.
select period, employment_thousands, employees_thousands + non_employees_thousands as summed
from {{ ref('french_national_accounts_annual') }}
where abs(employment_thousands - (employees_thousands + non_employees_thousands)) > 0.11
