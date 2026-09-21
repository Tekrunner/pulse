{#
  Eurostat's reporting-country codes are ISO 3166-1 alpha-2 with two long-
  standing exceptions of its own: EL for Greece and UK for the United Kingdom.
  This macro declares the whole vocabulary rather than transliterating it, so a
  code the provider adds arrives as null and fails the package's own test
  instead of being silently invented.

  EU27_2020 is Eurostat's own aggregate of the twenty-seven member states as
  constituted from 2020. It is a real published row, not a country, so it
  carries no alpha-3 code.
#}
{% macro eurostat_iso3(column) %}
  case {{ column }}
    when 'AT' then 'AUT'
    when 'BE' then 'BEL'
    when 'BG' then 'BGR'
    when 'CH' then 'CHE'
    when 'CY' then 'CYP'
    when 'CZ' then 'CZE'
    when 'DE' then 'DEU'
    when 'DK' then 'DNK'
    when 'EE' then 'EST'
    when 'EL' then 'GRC'
    when 'ES' then 'ESP'
    when 'FI' then 'FIN'
    when 'FR' then 'FRA'
    when 'HR' then 'HRV'
    when 'HU' then 'HUN'
    when 'IE' then 'IRL'
    when 'IS' then 'ISL'
    when 'IT' then 'ITA'
    when 'LI' then 'LIE'
    when 'LT' then 'LTU'
    when 'LU' then 'LUX'
    when 'LV' then 'LVA'
    when 'MD' then 'MDA'
    when 'ME' then 'MNE'
    when 'MK' then 'MKD'
    when 'MT' then 'MLT'
    when 'NL' then 'NLD'
    when 'NO' then 'NOR'
    when 'PL' then 'POL'
    when 'PT' then 'PRT'
    when 'RO' then 'ROU'
    when 'RS' then 'SRB'
    when 'SE' then 'SWE'
    when 'SI' then 'SVN'
    when 'SK' then 'SVK'
    when 'TR' then 'TUR'
    when 'UA' then 'UKR'
    when 'UK' then 'GBR'
    else null
  end
{% endmacro %}

{% macro eurostat_geo_kind(column) %}
  case when {{ column }} like 'EU%' or {{ column }} like 'EA%' then 'aggregate' else 'country' end
{% endmacro %}
