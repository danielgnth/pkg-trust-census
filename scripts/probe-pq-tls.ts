#!/usr/bin/env bun
/**
 * Probes each registry's install and publish hosts for hybrid post-quantum TLS key exchange,
 * the evidence behind the "Transport (TLS)" cells in src/facts/pqc.ts.
 *
 * Offers X25519MLKEM768 first, then the classical groups, and records what the server
 * picks, plus its certificate's key type. Needs OpenSSL 3.5 or newer (ML-KEM support); one
 * handshake per host, nothing is downloaded.
 *
 *   bun run scripts/probe-pq-tls.ts
 */

import type { EcosystemId } from "../src/types.ts";

const HOSTS: Record<EcosystemId, string[]> = {
  npm: ["registry.npmjs.org", "api.npmjs.org"],
  pypi: ["pypi.org", "files.pythonhosted.org", "upload.pypi.org"],
  crates: ["crates.io", "index.crates.io", "static.crates.io"],
  rubygems: ["rubygems.org", "index.rubygems.org"],
  go: ["proxy.golang.org", "sum.golang.org"],
  maven: ["repo1.maven.org", "repo.maven.apache.org", "central.sonatype.com"],
  // Packagist serves metadata; Composer downloads archives from the forge.
  packagist: ["packagist.org", "repo.packagist.org", "api.github.com", "codeload.github.com"],
};

async function openssl(args: string[]): Promise<string> {
  const p = Bun.spawn(["openssl", ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  return out + err;
}

async function probe(host: string) {
  const hs = await openssl(["s_client", "-connect", `${host}:443`, "-servername", host, "-groups", "X25519MLKEM768:X25519:secp256r1"]);
  const protocol = /Protocol\s*:\s*(\S+)/.exec(hs)?.[1] ?? /New, (TLSv[\d.]+)/.exec(hs)?.[1] ?? "?";
  // TLS 1.3 reports the negotiated group; TLS 1.2 only the ephemeral key.
  const group = /Negotiated TLS1\.3 group: (\S+)/.exec(hs)?.[1] ?? /(?:Peer|Server) Temp Key: ([^,\s]+)/.exec(hs)?.[1] ?? "?";
  const pem = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(hs)?.[0];
  let cert = "?";
  if (pem) {
    const tmp = `${process.env.TMPDIR ?? "/tmp"}/probe-${host}.pem`;
    await Bun.write(tmp, pem);
    const text = await openssl(["x509", "-in", tmp, "-noout", "-text"]);
    const alg = /Public Key Algorithm: (\S+)/.exec(text)?.[1];
    const bits = /Public-Key: \((\d+) bit\)/.exec(text)?.[1];
    cert = alg === "rsaEncryption" ? `RSA-${bits}` : alg === "id-ecPublicKey" ? `ECDSA-${bits}` : (alg ?? "?");
  }
  return { host, protocol, group, cert, hybrid: group.includes("MLKEM") };
}

console.log(`# ${new Date().toISOString()} · ${(await openssl(["version"])).trim()}`);
console.log("ecosystem,host,protocol,group,certificate,hybrid_pq");
for (const [eco, hosts] of Object.entries(HOSTS)) {
  for (const host of hosts) {
    const r = await probe(host);
    console.log([eco, r.host, r.protocol, r.group, r.cert, r.hybrid].join(","));
  }
}
