select period, geo_code, emigration_persons
from {{ ref('european_emigration_flows') }}
where emigration_persons < 0
