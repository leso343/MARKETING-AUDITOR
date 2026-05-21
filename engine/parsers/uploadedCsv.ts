/**
 * Tier 3 — parse Meta Ads CSV from raw text (used when CSVs come from DB).
 *
 * This is an additive sibling to parseMetaCsv(filePath) in metaAdsCsv.ts.
 * It intentionally duplicates ~15 lines of parsing glue to avoid touching
 * the existing parser (which Tier 2.5 modifies for toNumber decimal-comma
 * stripping and BreakdownRow fields). When the Tier 2.5 PR merges before
 * this branch, those fixes flow through `classify`, `mapAd`, etc., which
 * are imported here from the same file.
 */
import Papa from "papaparse";
import {
  classify,
} from "./metaAdsCsv";
import type {
  ParsedFile,
  ParsedRow,
} from "../types";

// `classify` plus the mapAd/mapAdSet/mapCampaign/mapBreakdown helpers in
// metaAdsCsv.ts aren't exported, so we re-do them by calling parseMetaCsv's
// public function via a synthetic file. Simpler: write our own minimal
// parser using classify() which IS exported, and then route rows through
// the same mappers via parseMetaCsv on a tempfile.
//
// To keep this strictly additive (no new exports from metaAdsCsv.ts), we
// shell out to a tempfile when parsing. The cost is negligible compared
// to the DB read.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseMetaCsv } from "./metaAdsCsv";

export interface UploadedCsv {
  filename: string;
  content: string;
}

/**
 * Parse a single CSV by writing it to a tempfile and calling parseMetaCsv.
 * The tempfile is cleaned up before return.
 */
export function parseUploadedCsv(file: UploadedCsv): ParsedFile {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-csv-"));
  const tmpPath = path.join(tmpDir, file.filename);
  try {
    fs.writeFileSync(tmpPath, file.content, "utf8");
    const parsed = parseMetaCsv(tmpPath);
    // Preserve original filename in the parsed result for fileSummary display.
    return { ...parsed, filePath: file.filename };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export function parseUploadedCsvs(files: UploadedCsv[]): ParsedFile[] {
  const out: ParsedFile[] = [];
  for (const f of files) {
    try {
      out.push(parseUploadedCsv(f));
    } catch (err) {
      console.error(`[uploaded-csv] failed to parse ${f.filename}: ${(err as Error).message}`);
    }
  }
  return out;
}

// Pure in-memory variant (no tempfile) — only used if the caller wants to
// short-circuit fs entirely. Uses Papa + classify and falls back to a
// minimal row mapping. Most callers should prefer parseUploadedCsv above.
export function parseUploadedCsvInMemory(file: UploadedCsv): { kind: string; headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(file.content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  const cls = classify(headers);
  return { kind: cls.kind, headers, rows: result.data };
}

// re-export for callers that want the type
export type { ParsedFile, ParsedRow };
