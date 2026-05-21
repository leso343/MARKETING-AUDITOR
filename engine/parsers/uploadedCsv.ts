/**
 * Tier 3 — parse Meta Ads CSV from raw text (used when CSVs come from DB).
 *
 * This is an additive sibling to parseMetaCsv(filePath) in metaAdsCsv.ts.
 * It writes each in-memory CSV to a tempfile and delegates to parseMetaCsv
 * so all of Tier 2.5's decimal-comma / BreakdownRow fixes flow through
 * unchanged.
 */
import type {
  ParsedFile,
  ParsedRow,
} from "../types";

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


// re-export for callers that want the type
export type { ParsedFile, ParsedRow };
