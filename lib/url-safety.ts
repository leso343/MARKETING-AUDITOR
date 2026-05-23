/**
 * SSRF guards for outbound fetches.
 *
 * NEW-C-11 fix: validates a URL before letting our server fetch it.
 * Rejects non-HTTPS schemes, private/reserved IP ranges, and known
 * cloud-metadata hostnames. Used by /api/fetch-logo. Should be reused
 * by any future feature that downloads attacker-supplied URLs.
 */
import dns from "node:dns/promises";
import net from "node:net";

const BAD_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254", // AWS / GCP / Azure metadata
  "100.100.100.200", // Alibaba metadata
  "fd00:ec2::254",   // AWS IPv6 metadata
  "localhost",
  "ip6-localhost",
]);

/**
 * RFC1918 + loopback + link-local + ULA + carrier-grade NAT.
 * Returns true if the IP literal falls in a non-public range.
 */
export function isPrivateAddress(ip: string): boolean {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;                              // 10/8
    if (a === 127) return true;                             // 127/8 loopback
    if (a === 169 && b === 254) return true;                // 169.254/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16/12
    if (a === 192 && b === 168) return true;                // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;      // 100.64/10 CGN
    if (a === 0) return true;                               // 0.0.0.0/8
    if (a >= 224) return true;                              // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lc = ip.toLowerCase();
    if (lc === "::" || lc === "::1") return true;            // unspec / loopback
    if (lc.startsWith("fe80")) return true;                  // link-local
    if (lc.startsWith("fc") || lc.startsWith("fd")) return true; // ULA fc00::/7
    if (lc.startsWith("ff")) return true;                    // multicast
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — extract v4 and re-check.
    const v4mapped = lc.match(/^::ffff:([\d.]+)$/);
    if (v4mapped) return isPrivateAddress(v4mapped[1]);
    return false;
  }
  // Unparseable — be safe.
  return true;
}

export type SafeUrlResult =
  | { ok: true; url: URL; resolvedAddresses: string[] }
  | { ok: false; reason: string };

/**
 * Validate that a URL is safe to fetch from the server. Performs:
 *   1. Parse with `new URL()` — rejects malformed input.
 *   2. Require https (no http, no file, no gopher, no data, no blob).
 *   3. Reject the hostname literal if it's a private IP or known
 *      cloud-metadata hostname.
 *   4. DNS-resolve the hostname (A + AAAA) and reject if ANY address is
 *      private. This blocks rebinding-friendly hostnames like
 *      `aws-metadata.example.com → 169.254.169.254`.
 *
 * Callers MUST re-validate after any redirect — the safer approach is
 * `fetch(url, { redirect: "manual" })` and call `validateOutboundUrl`
 * again on each `Location:` hop.
 */
export async function validateOutboundUrl(
  input: string,
  { allowHttp = false }: { allowHttp?: boolean } = {},
): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "Invalid URL." };
  }

  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    return { ok: false, reason: `Only https:// URLs are allowed (got ${url.protocol}).` };
  }

  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "URL has no host." };
  if (BAD_HOSTS.has(host)) {
    return { ok: false, reason: "Host is blocked (private / metadata service)." };
  }
  // Reject suspiciously short hosts (single label without a dot — e.g. "intranet")
  if (!host.includes(".") && !net.isIP(host)) {
    return { ok: false, reason: "Host must be a fully qualified domain or public IP." };
  }
  // If the host is an IP literal, check the range directly.
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      return { ok: false, reason: "Host is in a private / reserved IP range." };
    }
    return { ok: true, url, resolvedAddresses: [host] };
  }

  // DNS resolution — reject if ANY address is private.
  let addrs: string[] = [];
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    addrs = records.map((r) => r.address);
  } catch {
    return { ok: false, reason: "Could not resolve host." };
  }
  if (addrs.length === 0) {
    return { ok: false, reason: "Host did not resolve." };
  }
  for (const addr of addrs) {
    if (isPrivateAddress(addr)) {
      return { ok: false, reason: "Host resolves to a private / reserved address." };
    }
  }

  return { ok: true, url, resolvedAddresses: addrs };
}

/**
 * Render a URL safe to store on a client record (`logoUrl`, `websiteUrl`).
 * Fixes NEW-H-19. Returns the trimmed URL if it passes basic checks,
 * null otherwise. Does NOT do DNS resolution (that's only needed before
 * server-side fetches).
 */
export function sanitizeStoredUrl(input: unknown, { allowInternalPath = false } = {}): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (!v) return null;
  if (v.length > 2048) return null;
  // Allow internal app paths for logo URLs (e.g. "/csvs/.../logo.png" or "/api/logos/...").
  if (allowInternalPath && v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}
