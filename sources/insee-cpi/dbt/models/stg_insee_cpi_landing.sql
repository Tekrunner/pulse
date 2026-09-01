-- Faithful landing is the only dbt input. It remains string-valued by design.
select * from read_parquet('{{ var("landing_path") }}')
