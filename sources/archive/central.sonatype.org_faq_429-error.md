Read this first

Read this page carefully to understand what's changed, why change is needed, and what you can do about it.

Maven Central is beginning to enforce consumption limits for unusually high-volume traffic. If you are seeing a `429 Too Many Requests` response, your organization, network, tool, build environment, or infrastructure provider may be generating enough aggregate traffic to fall into one of the highest-consumption groups.

We are introducing these limits gradually. Today, enforcement is focused only on the highest-volume consumers — the top few percent of traffic patterns we see across Maven Central. Over time, those thresholds will move downward as we continue the transition toward a more sustainable consumption model.

[![Maven Central consumption limit rollout](../../images/traffic-curve.png)](../../images/traffic-curve.png)

_Real Maven Central traffic data. Dashed lines indicate current thresholds._

## What changed[⚓︎](#what-changed "Permanent link")

Maven Central is part of an industry-wide effort to bring consumption into balance.

This change is part of a broader industry effort to keep public package infrastructure reliable, secure, and open for the long term. The core principle is that ordinary development, open source publishing, and reasonable consumption should remain broadly available. The problem is not individual developers or small teams. The problem is industrial-scale consumption patterns that treat public registries as unlimited backend infrastructure while pushing the cost and operational burden onto the commons.

Maven Central is not alone in facing this pressure. Public package registries across ecosystems are seeing the same pattern: more automation, more CI/CD, more security scanning, more ephemeral infrastructure, and more machine-driven traffic. Registry operators and open source infrastructure stewards are increasingly working together to bring balance back into the ecosystem and make shared infrastructure sustainable.

For more context, read:

-   [Open Infrastructure is Not Free: A Joint Statement on Sustainable Stewardship](https://openssf.org/blog/2025/09/23/open-infrastructure-is-not-free-a-joint-statement-on-sustainable-stewardship/)
-   [Open Infrastructure Is Not Free, Part II: The Hidden Cost of Running Package Registries](https://openssf.org/blog/2026/05/06/open-infrastructure-is-not-free-part-ii-the-hidden-cost-of-running-package-registries/)
-   [Open Is Not Costless: Reclaiming Sustainable Infrastructure](https://www.sonatype.com/blog/open-is-not-costless-reclaiming-sustainable-infrastructure)

## Why am I seeing a 429?[⚓︎](#why-am-i-seeing-a-429 "Permanent link")

A `429 Too Many Requests` response is one visible part of that transition. It is not a judgment about your project, your team, or your intent. It means the aggregate traffic Maven Central sees from your organization, network, provider, platform, toolchain, or shared egress path has crossed a consumption threshold. In many cases, the traffic is not coming from one place in the obvious sense; it is the combined effect of many builds, tools, jobs, scanners, caches, or downstream consumers moving through the same infrastructure.

If you are seeing `429` responses, the first step is to understand what Maven Central sees from your side of the connection. Check your outbound egress paths, NAT gateways, CI systems, repository managers, dependency scanners, container builds, and automated jobs. The source of the traffic may not be the build that failed; it may be another part of the same organization, platform, or shared network producing enough aggregate consumption to trigger the limit.

Rate limits are not intended to be punitive. They are intended to create a clear signal that something in the consumption pattern needs to change. Initial blocks are deliberately short, so organizations have a chance to notice the pattern, investigate, and adjust before the impact becomes severe. When the same traffic patterns continue over time, those blocks may become longer. Unfortunately, we have found that many organizations do not investigate or reach out until blocks become disruptive, even though shorter blocks have often been occurring for some time.

In most cases, the right answer is not to retry harder. More retries usually make the problem worse. The goal is to reduce unnecessary traffic to Maven Central by caching artifacts, consolidating requests through a repository manager, fixing tools or jobs that bypass caches, and avoiding repeated downloads from clean or ephemeral environments when the same artifacts have already been retrieved.

## How long do blocks last?[⚓︎](#how-long-do-blocks-last "Permanent link")

Rate limit blocks are temporary. Once a block expires, access is automatically restored.

The length of each block depends on whether the same overconsumption pattern continues, and how many times it has recurred. Initial blocks are short and are meant to provide an early signal that something needs to change. If the pattern continues, new blocks may be triggered repeatedly, including multiple times in the same day. Over time, block durations increase, and for traffic that keeps re-offending, they can escalate substantially — up to a maximum of 30 days for sustained or repeated overconsumption.

Reaching the longest block durations requires repeated overconsumption over **many days or weeks**, not a single spike in traffic. If the underlying traffic pattern changes and overconsumption stops, new blocks will not be triggered and access will remain restored.

**Note:** Maven Central uses multiple rate limiting and abuse-prevention mechanisms, and block durations can differ between overconsumption and other violation types (such as scraping). The timelines above are general guidance and may be adjusted as we tune the system. Extreme over-limit activity, attempts to evade limits, or clear abuse may result in longer or permanent blocks without the same gradual ramp.

## What should I do next?[⚓︎](#what-should-i-do-next "Permanent link")

Reducing unnecessary traffic to Maven Central is the best way to avoid future blocks and prevent existing blocks from escalating. Below are common scenarios we see, with more specific guidance for what you can do next.

Choose the path that best describes your situation.

### I do not have a repository manager[⚓︎](#i-do-not-have-a-repository-manager "Permanent link")

Use this path if your builds, tools, CI jobs, scanners, containers, or developer machines download directly from Maven Central without a repository manager or caching proxy in between.

[I do not have a repository manager →](../429-no-repo-manager/)

### I already have a repository manager[⚓︎](#i-already-have-a-repository-manager "Permanent link")

Use this path if you already operate a repository manager, but are still seeing `429` responses. This usually means some traffic is bypassing the repository manager, the cache is not behaving as expected, or other tools in your environment are still reaching Maven Central directly.

[I already have a repository manager →](../429-has-repo-manager/)

### I am an infrastructure provider, CI provider, cloud provider, security vendor, or large platform[⚓︎](#i-am-an-infrastructure-provider-ci-provider-cloud-provider-security-vendor-or-large-platform "Permanent link")

Use this path if your service, platform, or infrastructure downloads from Maven Central on behalf of many downstream customers, tenants, workloads, users, or projects. Your traffic may need to be evaluated at the platform level, not only as individual build activity.

[I am an infrastructure provider →](../429-infrastructure-provider/)

### I provide tooling that fetches Java components[⚓︎](#i-provide-tooling-that-fetches-java-components "Permanent link")

Use this path if you provide a tool, scanner, plugin, build service, platform, or other software that resolves, downloads, analyzes, enriches, mirrors, or inspects Java components from Maven Central. If your customers or users are being disproportionately rate limited, the cause may not be their builds.

[I provide tooling that fetches Java components →](../429-tooling-provider/)

### I think I am being grouped with other traffic[⚓︎](#i-think-i-am-being-grouped-with-other-traffic "Permanent link")

Use this path if your own activity seems reasonable, but you may be sharing egress with other organizations, tenants, teams, or workloads through corporate NAT, VPNs, hosted CI, cloud infrastructure, or another shared platform.

[I think I am being grouped with other traffic →](../429-shared-egress/)

### I am fetching a large runtime artifact or server distribution[⚓︎](#i-am-fetching-a-large-runtime-artifact-or-server-distribution "Permanent link")

Use this path if you are not downloading a build dependency — you are fetching a large archive that a server, deployment pipeline, or provisioning script needs at runtime. Examples include server tarballs, application distributions, or large binaries that are fetched repeatedly across a fleet rather than cached as a build artifact.

[I am fetching a large runtime artifact →](../429-operational-dependencies/)

### I am downloading the Maven Central index[⚓︎](#i-am-downloading-the-maven-central-index "Permanent link")

Use this path if you are seeing rate limit responses when fetching the Maven Central Lucene index files from `/maven2/.index/`. This includes the full index (`nexus-maven-repository-index.gz`) and incremental update chunks.

[Maven Central index download limits →](../429-maven-index/)

## Still need help?[⚓︎](#still-need-help "Permanent link")

If you continue to see `429` responses after reviewing your traffic patterns, caching, repository manager configuration, and shared egress paths, see [429: Contact support](../429-contact-support/) for what to gather and how to reach us.
