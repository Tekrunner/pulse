select period, geo_code, immigration_persons
from {{ ref('european_immigration_flows') }}
where immigration_persons < 0
