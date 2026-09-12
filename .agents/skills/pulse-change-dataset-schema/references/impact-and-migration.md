# Impact inventory and migration gate

Create the proposed contract outside the live package first. Run:

```sh
uv run --no-sync pulse dataset impact <dataset-id> --contract <proposed-contract> --output <impact.json>
```

The conservative scanner combines dataset/table identity with repository searches for old and new column names. Inspect all results and add missed dynamically assembled consumers manually. Required surfaces are dataset contracts/models/tests, report declarations and lineage, main and exploration SQL, visual contracts/fixtures and row mapping, accessible tables, Node/browser/Python tests, and generated catalog inputs. Do not dismiss an ambiguous result without a recorded reason.

Removed or retyped columns are breaking. Metadata/semantic edits to retained columns are compatible modifications. Pure new columns are compatible additions. Mixed changes take the most severe classification. Advance the v1 minor contract for any schema edit and keep `previous_contract_version` exact.

For atomic migration, commit the dbt model/tests, contract, `schema-change.yaml`, every affected query/schema/fixture/lineage declaration, and conformance tests together. A breaking plan must list all affected consumers as `migrated`; publication rejects an empty or unresolved plan. Then run:

```sh
uv run --no-sync pytest tests/datasets tests/runtime -q
npm run verify
uv run --no-sync pulse verify
git diff --check
```

Exercise non-empty real fixture rows, accessible equivalents, silent wrong-value/type cases, siblings after one consumer fails, atomic-write interruption, and prior-publication retention.
