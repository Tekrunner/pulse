-- A box whose west is east of its east, or whose south is north of its north,
-- would silently break any map that frames itself from these columns.
select departement_code, bbox_west, bbox_south, bbox_east, bbox_north
from {{ ref('french_departement_geometry') }}
where bbox_west >= bbox_east or bbox_south >= bbox_north
