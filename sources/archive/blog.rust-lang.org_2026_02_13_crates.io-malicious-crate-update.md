The crates.io team will no longer publish a blog post each time a malicious crate is detected or reported. In the vast majority of cases to date, these notifications have involved crates that have no evidence of real world usage, and we feel that publishing these blog posts is generating noise, rather than signal.

We will always publish a [RustSec](https://rustsec.org/) advisory when a crate is removed for containing malware. You can subscribe to the [RustSec advisory RSS feed](https://rustsec.org/feed.xml) to receive updates.

Crates that contain malware _and_ are seeing real usage or exploitation will still get both a blog post and a RustSec advisory. We may also notify via additional communication channels (such as social media) if we feel it is warranted.

## Recent crates

Since we are announcing this policy change now, here is a retrospective summary of the malicious crates removed since [our last blog post](https://blog.rust-lang.org/2025/12/05/crates.io-malicious-crates-finch-rust-and-sha-rust/) and today:

-   `finch_cli_rust`, `finch-rst`, and `sha-rst`: the Rust security response working group was notified on December 9th, 2025 by Matthias Zepper of [National Genomics Infrastructure Sweden](https://ngisweden.scilifelab.se/) that these crates were attempting to exfiltrate credentials by impersonating the `finch` and `finch_cli` crates. Advisories: [RUSTSEC-2025-0150](https://rustsec.org/advisories/RUSTSEC-2025-0150.html), [RUSTSEC-2025-0151](https://rustsec.org/advisories/RUSTSEC-2025-0151.html), [RUSTSEC-2025-0152](https://rustsec.org/advisories/RUSTSEC-2025-0152.html).
-   `polymarket-clients-sdk`: we were notified on February 6th by [Socket](https://socket.dev/) that this crate was attempting to exfiltrate credentials by impersonating the `polymarket-client-sdk` crate. Advisory: [RUSTSEC-2026-0010](https://rustsec.org/advisories/RUSTSEC-2026-0010.html).
-   `polymarket-client-sdks`: we were notified on February 13th that this crate was attempting to exfiltrate credentials by impersonating the `polymarket-client-sdk` crate. Advisory: [RUSTSEC-2026-0011](https://rustsec.org/advisories/RUSTSEC-2026-0011.html).

In all cases, the crates were deleted, the user accounts that published them were immediately disabled, and reports were made to upstream providers as appropriate.

## Thanks

Once again, our thanks go to Matthias, Socket, and the reporter of `polymarket-client-sdks` for their reports. We also want to thank Dirkjan Ochtman from the secure code working group, Emily Albini from the security response working group, and Walter Pearce from the [Rust Foundation](https://foundation.rust-lang.org/) for aiding in the response.
