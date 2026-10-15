/**
 * Pluggable HTTP transport, shaped like `fetch` so ky can use it directly.
 *
 * `fetch` is the default and is what runs on a normal developer machine. A curl-backed
 * transport exists because Bun's `fetch` cannot traverse an HTTPS CONNECT proxy (its
 * `node:http` shim is implemented over fetch, so the usual tunnel workaround fails too).
 * Sandboxed CI environments commonly route egress that way, so without this the pipeline
 * could only be developed against the handful of hosts on the proxy bypass list.
 *
 * Keeping this behind an interface also makes the client testable without a network.
 */

export interface Transport {
  readonly name: string;
  fetch(request: Request): Promise<Response>;
}

export const fetchTransport: Transport = {
  name: "fetch",
  fetch: (request) => fetch(request, { redirect: "follow" }),
};

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

  async fetch(request: Request): Promise<Response> {
    const url = request.url;
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
    if (request.method === "HEAD") args.push("--head", "-o", "/dev/null");
    // A body goes through stdin, so it never appears in the process list or hits ARG_MAX.
    const payload = request.body ? await request.text() : null;
    if (payload !== null) args.push("-X", request.method, "--data-binary", "@-");
    request.headers.forEach((v, k) => args.push("-H", `${k}: ${v}`));
    args.push("--url", url);

    const proc = Bun.spawn(["curl", ...args], {
      stdin: payload !== null ? new Blob([payload]) : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
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

    return new Response(body || null, { status, headers: parseHeaderJson(rest.join("\n")) });
  }
}

function parseHeaderJson(raw: string): Headers {
  const headers = new Headers();
  if (!raw.trim()) return headers;
  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v) && v.length > 0) headers.set(k, v[v.length - 1]!);
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
  if (forced === "fetch") return fetchTransport;
  if (forced === "curl") return new CurlTransport();

  const proxied = Boolean(process.env.HTTPS_PROXY ?? process.env.https_proxy);
  return proxied ? new CurlTransport() : fetchTransport;
}
