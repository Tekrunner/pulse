{% macro oecd_member_codes() %}
{#
  The 38 OECD member economies, as ISO-3166 alpha-3 codes.

  A classification, not data: the Productivity Database mixes members,
  non-member economies it also covers and computed aggregates, and nothing in
  the response distinguishes them. It changes only when the OECD admits a
  member, a deliberate edit with a contract review; the accompanying test fails
  if a code here stops appearing in the provider response.
#}
{{ return([
  'AUS', 'AUT', 'BEL', 'CAN', 'CHE', 'CHL', 'COL', 'CRI', 'CZE', 'DEU',
  'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GBR', 'GRC', 'HUN', 'IRL', 'ISL',
  'ISR', 'ITA', 'JPN', 'KOR', 'LTU', 'LUX', 'LVA', 'MEX', 'NLD', 'NOR',
  'NZL', 'POL', 'PRT', 'SVK', 'SVN', 'SWE', 'TUR', 'USA'
]) }}
{% endmacro %}


{% macro oecd_aggregate_codes() %}
{#
  Computed aggregates the Productivity Database publishes alongside countries:
  the OECD total, the euro area of 20 and the EU of 27. They are never members.
#}
{{ return(['EA20', 'EU27_2020', 'OECD']) }}
{% endmacro %}


{% macro oecd_area_kind(code_expression) %}
case
  when {{ code_expression }} in ({% for code in oecd_member_codes() %}'{{ code }}'{{ ", " if not loop.last }}{% endfor %}) then 'member'
  when {{ code_expression }} in ({% for code in oecd_aggregate_codes() %}'{{ code }}'{{ ", " if not loop.last }}{% endfor %}) then 'aggregate'
  else 'non-member'
end
{% endmacro %}
