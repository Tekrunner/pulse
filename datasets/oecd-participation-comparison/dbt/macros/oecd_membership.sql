{% macro oecd_member_codes() %}
{#
  The 38 OECD member economies, as ISO-3166 alpha-3 codes.

  This list is a classification, not data: the OECD dataflow mixes members,
  non-member reference areas it also publishes (Brazil, Bulgaria, Croatia,
  Romania) and computed aggregates, and nothing in the response distinguishes
  them. Membership is an analytical fact about the world, so it is stated once
  here and published as reference_area_kind, rather than left for every
  consumer to infer from a country name.

  It changes only when the OECD admits a member, which is a deliberate edit
  accompanied by a contract review, and the accompanying test fails loudly if a
  code here stops appearing in the provider response.
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
  Computed aggregates the OECD publishes alongside countries. They belong in the
  table because a reader comparing France to "the OECD" wants exactly this, but
  they must never be counted as members or ranked among them.
#}
{{ return(['EA', 'EU', 'G7', 'OECD']) }}
{% endmacro %}


{% macro oecd_area_kind(code_expression) %}
case
  when {{ code_expression }} in ({% for code in oecd_member_codes() %}'{{ code }}'{{ ", " if not loop.last }}{% endfor %}) then 'member'
  when {{ code_expression }} in ({% for code in oecd_aggregate_codes() %}'{{ code }}'{{ ", " if not loop.last }}{% endfor %}) then 'aggregate'
  else 'non-member'
end
{% endmacro %}
