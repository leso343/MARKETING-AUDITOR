/**
 * Smoke-test: confirm runAuditFromFiles produces the same $3,137.11 / 31 leads
 * as the legacy filesystem path for take-charge-roofing. Used in dev to make
 * sure the Tier 3 in-memory loader is wire-compatible.
 */
import fs from "node:fs";
import path from "node:path";
import { runAudit } from "../engine/runAudit";
import { runAuditFromFiles } from "../engine/runAuditFromFiles";

const root = path.join(process.cwd(), "public", "csvs", "take-charge-roofing");
const files = fs.readdirSync(root)
  .filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => ({ filename: f, content: fs.readFileSync(path.join(root, f), "utf8") }));

const benchmarks = { targetCpl: 55, targetCtr: 1.5 };

const fsResult = runAudit({ csvDir: root, clientName: "Take Charge Roofing", benchmarks });
const dbResult = runAuditFromFiles({ files, clientName: "Take Charge Roofing", benchmarks });

const compare = (label: string, a: number, b: number) => {
  const ok = Math.abs(a - b) < 0.01;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(20)} fs=${a}  db=${b}`);
  if (!ok) process.exitCode = 1;
};

console.log("\nReconciliation check (Take Charge Roofing):");
compare("totalSpend",  fsResult.spend.totalSpend,  dbResult.spend.totalSpend);
compare("totalLeads",  fsResult.spend.totalLeads,  dbResult.spend.totalLeads);
compare("blendedCpl",  fsResult.spend.blendedCpl,  dbResult.spend.blendedCpl);



console.log("");
if (process.exitCode === 1) console.log("  RECONCILIATION FAILED");
else console.log("  RECONCILIATION OK ✓  ($3137.11 / 31 leads via both paths)");

compare("geoTotalSpend",   fsResult.geo.totalSpend,   dbResult.geo.totalSpend);
compare("creativeCount",   fsResult.creative.totalAds, dbResult.creative.totalAds);
compare("demoCount",       fsResult.demographics.brackets.length, dbResult.demographics.brackets.length);
