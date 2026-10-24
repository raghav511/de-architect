{# Use the schema name exactly as configured (gold), not "<target>_gold". #}
{% macro generate_schema_name(custom_schema_name, node) -%}{{ custom_schema_name or target.schema }}{%- endmacro %}
