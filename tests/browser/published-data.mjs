// Report specs compare what a page displays against the Parquet the served
// artifact carries. A literal "latest value" would fail the gate in front of
// deployment on every scheduled refresh without saying anything about whether
// the page is right, so the expectation is read here instead. The query runs
// in the repository's Python DuckDB, not in the report's own browser engine,
// so the page and its expectation never share an implementation.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const artifactData = resolve(root, "dist/_import/data/datasets");
const python =
  process.env.PULSE_PYTHON ||
  resolve(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

const QUERY = String.raw`
import datetime, decimal, json, sys
import duckdb

root, datasets, sql = sys.argv[1], json.loads(sys.argv[2]), sys.argv[3]
connection = duckdb.connect()
for dataset in datasets:
    path = f"{root}/{dataset}/dataset.parquet".replace("'", "''")
    connection.execute(f"""CREATE VIEW "{dataset}" AS SELECT * FROM read_parquet('{path}')""")
cursor = connection.execute(sql)
names = [column[0] for column in cursor.description]

def plain(value):
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return value

print(json.dumps([dict(zip(names, map(plain, row))) for row in cursor.fetchall()]))
`;

/** Rows of `sql`, where each dataset ID is a view over its served Parquet. */
export function publishedRows(datasets, sql) {
  const output = execFileSync(python, ["-c", QUERY, artifactData, JSON.stringify(datasets), sql], {
    encoding: "utf8",
  });
  return JSON.parse(output);
}
