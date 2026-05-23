/**
 * Tier 3 — parse Meta Ads CSV from raw text (used when CSVs come from DB).
 *
 * This is an additive sibling to parseMetaCsv(filePath) in metaAdsCsv.ts.
 * It writes each in-memory CSV to a tempfile and delegates to parseMetaCsv
 * so all of Tier 2.5's decimal-comma / BreakdownRow fixes flow through
 * unchanged.
 *
 * C-3 fix: filename is forced through `path.basename` before being used
 * as a path. The upload route already validates against a strict regex,
 * but defense-in-depth: even if a future caller passes something
 * malicious here, we never escape the tmpdir.
 *
 * M-15 fix: parse errors are returned to the caller instead of being
 * silently swallowed.
 */
import type { ParsedFile, ParsedRow } from "../types";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseMetaCsv } from "./metaAdsCsv";

export interface UploadedCsv {
  filename: string;
  content: string;
}

export interface ParseResult {
  files: ParsedFile[];
  warnings: { filename: string; error: string }[];
}

const SAFE_NAME_RE = /^[a-zA-Z0-9._-]{1,128}$/;

function sanitize(filename: string): string {
  // basename strips any path components.
  const base = path.basename(filename || "");
  if (!base || base === "." || base === "..") {
    // Fall back to a random-ish name so we never write to "" or "..".
    return `upload-${Math.random().toString(36).slice(2)}.csv`;
  }
  if (!SAFE_NAME_RE.test(base)) {
    return `upload-${Math.random().toString(36).slice(2)}.csv`;
  }
  return base;
}

export function parseUploadedCsv(file: UploadedCsv): ParsedFile {
  const safeName = sanitize(file.filename);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-csv-"));
  const tmpPath = path.join(tmpDir, safeName);
  try {
    fs.writeFileSync(tmpPath, file.content, "utf8");
    const parsed = parseMetaCsv(tmpPath);
    // Preserve the original (validated) filename for display.
    return { ...parsed, filePath: safeName };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export function parseUploadedCsvs(files: UploadedCsv[]): ParsedFile[] {
  return parseUploadedCsvsWithWarnings(files).files;
}

export function parseUploadedCsvsWithWarnings(files: UploadedCsv[]): ParseResult {
  const out: ParsedFile[] = [];
  const warnings: { filename: string; error: string }[] = [];
  for (const f of files) {
    try {
      out.push(parseUploadedCsv(f));
    } catch (err) {
      const msg = (err as Error).message ?? "Unknown parse error";
      warnings.push({ filename: f.filename, error: msg });
      // eslint-disable-next-line no-console
      console.error(`[uploaded-csv] failed to parse ${f.filename}: ${msg}`);
    }
  }
  return { files: out, warnings };
}

// re-export for callers that want the type
export type { ParsedFile, ParsedRow };
