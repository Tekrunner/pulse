import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const legacySpecs = new Map([
  ["french-consumer-prices", "pilot.spec.js"],
  ["french-unemployment", "unemployment.spec.js"],
  ["world-demography", "demography.spec.js"],
]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveReportSpec(reportId, workspace = root) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reportId ?? "")) {
    throw new Error("report ID must be lowercase kebab-case");
  }
  const declaration = resolve(workspace, "site", "reports", reportId, "report.yml");
  if (!(await exists(declaration))) throw new Error(`unknown report '${reportId}'`);

  const conventional = resolve(workspace, "tests", "browser", `${reportId}.spec.js`);
  if (await exists(conventional)) return conventional;
  const legacy = legacySpecs.get(reportId);
  if (legacy) {
    const path = resolve(workspace, "tests", "browser", legacy);
    if (await exists(path)) return path;
  }
  throw new Error(
    `report '${reportId}' has no browser spec; expected tests/browser/${reportId}.spec.js`,
  );
}

async function main(arguments_) {
  const [reportId, ...playwrightArguments] = arguments_;
  if (!reportId) {
    throw new Error(
      "usage: npm run browser:test:report -- <report-id> [Playwright options]",
    );
  }
  const spec = await resolveReportSpec(reportId);
  // Playwright matches this positionally as a regular expression against each
  // test file's path, so it takes a repository-relative POSIX path. An
  // absolute Windows path is not a valid pattern -- its separators read as
  // escapes -- and so selects nothing rather than failing loudly.
  const pattern = relative(root, spec).split(sep).join("/");
  const executable = resolve(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "playwright.cmd" : "playwright",
  );
  const completed = spawnSync(
    executable,
    [
      "test",
      "--config",
      resolve(root, "tests/browser/playwright.config.js"),
      pattern,
      ...playwrightArguments,
    ],
    {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (completed.error) throw completed.error;
  if (completed.status !== 0) {
    throw new Error(`${basename(executable)} exited ${completed.status ?? 1}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
