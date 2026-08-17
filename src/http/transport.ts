/**
 * Pluggable HTTP transport.
 *
 * `fetch` is the default and is what runs on a normal developer machine. A curl-backed
 * transport exists because Bun's `fetch` cannot traverse an HTTPS CONNECT proxy (its
 * `node:http` shim is implemented over fetch, so the usual tunnel workaround fails too).
 * Sandboxed CI environments commonly route egress that way, so without this the pipeline
 * could only be developed against the handful of hosts on the proxy bypass list.
 *
 * Keeping this behind an interface also makes the client testable without a network.
 */

export interface TransportResponse {
  status: number;
  body: string;
  headers: Map<string, string>;
}

export interface TransportRequest {
  method: "GET" | "HEAD";
  headers: Record<string, string>;
}

export interface Transport {
  readonly name: string;
  request(url: string, req: TransportRequest): Promise<TransportResponse>;
}

export class FetchTransport implements Transport {
  readonly name = "fetch";

  async request(url: string, req: TransportRequest): Promise<TransportResponse> {
    const res = await fetch(url, {
      method: req.method,
      headers: req.headers,
      redirect: "follow",
    });
    const headers = new Map<string, string>();
    res.headers.forEach((v, k) => headers.set(k.toLowerCase(), v));
    return {
      status: res.status,
      body: req.method === "HEAD" ? "" : await res.text(),
      headers,
    };
  }
}

/**
 * Delimits the response body from the trailing status/header metadata that `-w` appends.
 * Chosen so it cannot appear in a JSON document body.
 */
const SENTINEL = " __CURL_META__ ";

/**
 * Shells out to curl, which reads HTTPS_PROXY and the system CA store natively.
 *
 * Status and headers are appended after the body via `-w` and split off at the sentinel,
 * so a single process yields everything the client needs, including Retry-After.
 */
export class CurlTransport implements Transport {
  readonly name = "curl";

  /** Long enough for a multi-megabyte npm packument, short enough to fail a hung host. */
  constructor(private readonly timeoutSec = 120) {}

  async request(url: string, req: TransportRequest): Promise<TransportResponse> {
    const args = [
      "-sS",
      "--compressed",
      "--location",
      "--max-time",
      String(this.timeoutSec),
      // Bun.spawn rejects arguments containing literal newlines, so the escapes are left
      // for curl to expand into the separators the parser below splits on.
      "-w",
      String.raw`\n` + SENTINEL + String.raw`\n%{http_code}\n%{header_json}`,
    ];
    if (req.method === "HEAD") args.push("--head", "-o", "/dev/null");
    for (const [k, v] of Object.entries(req.headers)) args.push("-H", `${k}: ${v}`);
    args.push("--url", url);

    const proc = Bun.spawn(["curl", ...args], { stdout: "pipe", stderr: "pipe" });
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    if (code !== 0) throw new Error(`curl exit ${code}: ${err.trim() || "no stderr"}`);

    const marker = `\n${SENTINEL}\n`;
    const idx = out.lastIndexOf(marker);
    if (idx === -1) throw new Error(`curl produced no status marker for ${url}`);

    const body = out.slice(0, idx);
    const [statusLine, ...rest] = out.slice(idx + marker.length).split("\n");
    const status = Number(statusLine);
    if (!Number.isInteger(status)) throw new Error(`curl returned no status for ${url}`);

    return { status, body, headers: parseHeaderJson(rest.join("\n")) };
  }
}

function parseHeaderJson(raw: string): Map<string, string> {
  const headers = new Map<string, string>();
  if (!raw.trim()) return headers;
  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v) && v.length > 0) headers.set(k.toLowerCase(), v[v.length - 1]!);
    }
  } catch {
    // Headers are a convenience (Retry-After); a parse failure must not fail the request.
  }
  return headers;
}

/**
 * Picks a transport for the current environment.
 *
 * Set PKG_TRUST_TRANSPORT=fetch|curl to override — worth doing when reproducing a run and
 * you want the transport pinned rather than chosen by the environment.
 */
export function defaultTransport(): Transport {
  const forced = process.env.PKG_TRUST_TRANSPORT;
  if (forced === "fetch") return new FetchTransport();
  if (forced === "curl") return new CurlTransport();

  const proxied = Boolean(process.env.HTTPS_PROXY ?? process.env.https_proxy);
  return proxied ? new CurlTransport() : new FetchTransport();
}
