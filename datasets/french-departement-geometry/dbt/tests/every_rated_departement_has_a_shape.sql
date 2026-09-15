-- The 100 territories INSEE publishes a localised rate for must all have
-- geometry. Mayotte (976) has geometry but no rate, which is a surplus and not
-- checked here. This test is the one that keeps the choropleth hole-free.
{% set rated = [
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19',
  '21','22','23','24','25','26','27','28','29','2A','2B','30','31','32','33','34','35','36','37',
  '38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56',
  '57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75',
  '76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94',
  '95','971','972','973','974'
] %}
with rated(departement_code) as (
  values {% for code in rated %}('{{ code }}'){{ ", " if not loop.last }}{% endfor %}
)
select rated.departement_code
from rated
left join {{ ref('french_departement_geometry') }} as shapes
  on shapes.departement_code = rated.departement_code
where shapes.departement_code is null
