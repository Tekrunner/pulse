{{ config(materialized='external', location=var('external_location'), format='parquet') }}

select * from {{ ref('upstream') }}
