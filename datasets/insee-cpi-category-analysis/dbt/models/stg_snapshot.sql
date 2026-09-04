-- The immutable source snapshot is the only dbt input.
select * from read_parquet('{{ var("snapshot_path") }}')
