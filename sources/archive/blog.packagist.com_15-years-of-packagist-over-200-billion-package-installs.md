[opensource](https://blog.packagist.com/tag/opensource/)

![Packagist elephant logo, over headline "15 years of Packagist: Over 200 billion package installs" next to elephant beaming at cake with candles and "15" on the frosting surrounded by packages](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/size/w2000/2026/09/2026-09-29-15-years-of-packagist-1.png)

On September 27th, 2011, Jordi submitted [monolog/monolog](https://packagist.org/packages/monolog/monolog) to Packagist.org, it got package ID 1. Fifteen years later, Packagist.org lists more than 469,000 packages with over 5.8 million versions, and Composer has installed packages from it more than 200 billion times. Monolog alone has passed one billion installs.

This year also marks ten years of Private Packagist, the company we founded to make Composer and Packagist.org sustainable. We want to use the occasion to look back at how it all started, at the milestones along the way, and at what we are working on for the years ahead.

## How it started

In 2010 we met at Symfony Live in Paris. [Fabien Potencier](https://fabien.potencier.org/about.html) presented a first preview of Symfony2, Jordi gave a talk together with [Lukas Kahwe Smith](https://pooteeweet.org/), and Nils was there to find out whether the forum software phpBB could move to Symfony. After the second conference day we ended up at a Korean restaurant, which became a regular annual dinner for the following years.

We both faced the same problem: phpBB needed a flexible plugin system with installation, upgrades and dependency management, and Symfony's modular component and bundle approach needed something better than the git repository shell download script it shipped with. Work on what became Composer started on February 5th, 2011. At the [SymfonyLive 2011 hackdays](https://symfony.com/blog/hacking-days-at-symfony-live-conference-in-san-francisco) in San Francisco, Fabien pointed Nils at openSUSE's libzypp SAT solver, and Nils began porting the C library to PHP to explore it as the core of a PHP package manager.

A few weeks later, at SymfonyLive 2011 in Paris, conversations with Symfony users and contributors made it clear that a solution was needed urgently, and over another Korean dinner Jordi offered to help. After long discussions about names with Jordi and Fabien, and a healthy amount of nudging from Jordi to finally share some code, Nils pushed the [first Composer commit](https://github.com/composer/composer/commit/933cc6179b43e4aa5d1e477375b0c85cd4285b3d) on April 5th, 2011.

### From PEAR proxy to package repository

Four days later Jordi registered the packagist.org domain, and shortly after he [announced](https://x.com/seldaek/status/57833358545264640) the first version of Packagist. It started out as a proxy and aggregator for all the PEAR channels available at the time. As Jordi wrote in an email a few days later:

> The packagist.org thing I "launched" yesterday is meant to be a repository of general purpose php libraries \[...\] It is built as a PEAR proxy for now, but that will most likely disappear once we have a working solution coupled with Composer.

Over the summer, Composer and Packagist.org grew together. On July 6th, 2011, Jordi reported that the entire pipeline worked for the first time: submit Monolog through the web interface, have Packagist.org generate a packages.json, and let Composer read it and download Monolog from GitHub as a zip file. The same email contains a line that sounds familiar fifteen years later:

> Also we still have one bug in the dependency solving, if you happen to be really good with C we could use help there because Nils is the only one that knows the code right now and he doesn't have much time.

On August 21st, 2011, in one of the first emails to the composer-dev mailing list, Jordi described the first successful installation of Monolog with package information fed from Packagist.org and the dependency solver picking the packages to install. These were simpler times, all of this still ran over plain unencrypted HTTP. Two days later the [first concept of vendor names](https://github.com/composer/packagist/commit/7ec738) appeared in Packagist code, still as foo-bar rather than foo/bar. At some point the database was reset, and on September 27th, 2011 monolog/monolog became package ID 1.

## Fifteen years of milestones

### Composer 1.0 and 2.0

Composer was usable, and widely used, long before it had a stable version. Packagist.org started counting installs on April 13th, 2012, and by the time Composer 1.0.0 was released on April 5th, 2016, exactly five years after the first commit, it had long become the standard way to manage dependencies in PHP. To mark the occasion, Jordi auctioned a gold master copy of Composer 1.0 on floppy disk.

![Golden floppy disk with label containg Composer logo and the text "COMPOSER v1.0.0 2016 ANNIVERSARY GOLD EDITION COPYRIGHT Jordi Boggiano, Nils Adermann DISK 1: INSTALL"](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/09/data-src-image-e8f5595c-f7e9-48ed-bd13-7c8acf665d01.png)

Floppy containing Composer v1.0.0 - 2016 Anniversary Gold Edition

Composer 2.0 followed on October 24th, 2020 with a rewritten dependency resolution pipeline, parallel downloads and a new metadata protocol. Updates became dramatically faster and used a fraction of the memory, and Packagist.org served far less data per update. Composer 2 has since received regular feature releases, most recently [Composer 2.10](https://blog.packagist.com/composer-2-10-release/) this year.

### A company to sustain the project

In 2016 we founded Private Packagist and launched the product at SymfonyCon 2016 in Berlin that December. Private Packagist gives companies private package hosting, mirroring of open-source and third-party packages, security monitoring, update review and package usage tracking. Every subscription funds our work on Composer and Packagist.org, and for ten years Private Packagist has covered the majority of the cost of running both.

Stephan Vock joined us just a few months after we founded the company. Today the Packagist team is just over ten people, with some helping out part time. Earlier this month we celebrated the company's tenth anniversary together with the team, their families and a few close friends who helped us along the way.

![9 people posing for a photoin front of golden baloons with the number 10](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/09/data-src-image-c172f297-61b0-4cb9-8124-b13a81f69c88-1.jpeg)

10 years of Private Packagist anniversary party

### Growing with the ecosystem

Packagist.org ran on a single personal server with 100 Mbps of bandwidth from 2011 until April 2015, when it handled around 67 million installs per month. By March 2019 that had grown to 592 million installs per month, and we [moved to AWS](https://blog.packagist.com/an-update-on-packagist-org-hosting/) for a highly available setup with mirrors around the world.

It took until August 2015 to reach the first billion installs. Packagist.org passed 10 billion in August 2018, 50 billion in December 2021 and 100 billion in January 2024. At the same time monthly installs first exceeded one billion in September 2020, a month before Composer 2.0 was released. The second 100 billion took just two years and eight months, and this month the total passed 200 billion.

After many years of steady growth, both installs and newly published versions have grown noticeably faster since the beginning of 2026, coinciding with the increasing adoption of AI coding tools. Monthly installs went from 3 billion in January to 4.9 billion in August, and September has already passed 5 billion with a few days left to go. With over 36 billion installs so far, 2026 has already exceeded the total for all of 2025.

![Graph showing Packages and versions over time, versions have a steady increase from close to 0 in 2013 to about 5 million end of 2025 and now close to 6 million in September of 2026](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/09/data-src-image-13771817-6ce5-4a72-9d87-09913c992d73.png)

Versions and package count on Packagist.org over time

![A graph showing packages installed per month over time, starting slowly in 2012, and growing at increasing speed until around 2022 when the graph starts to fluctuate more with a peak in the middle of 2025 and then sharply increasing from December 2025](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/09/data-src-image-158ed444-346a-4391-bcaa-5df9eb095543.png)

Package installs per month

Some numbers from fifteen years of Composer and Packagist.org:

-   **201.6 billion** package installs since April 2012
-   **469,000+** packages and **5.8 million+** versions on Packagist.org
-   **1 billion+** installs of monolog/monolog, package ID 1
-   **13,000+** commits to Composer from **over 1,000** contributors, plus more than 3,200 commits from 158 contributors to Packagist.org itself

Thank you to everyone who contributed code, reported bugs, answered questions, or maintains one of the hundreds of thousands of packages on Packagist.org. Composer and Packagist exist because of this community.

### Retiring Composer 1.x support

Carrying two metadata formats became a growing burden on infrastructure and on our team. After years of Composer 2 being the default, Packagist.org [ended metadata support for Composer 1.x](https://blog.packagist.com/packagist-org-shutdown-of-composer-1-x-support-postponed-to-september-1st-2025/) on September 1st, 2025, which freed up resources for the work that followed.

### Supply chain security and sustainability in 2026

This year has been dominated by software supply chain security. Open-source ecosystems, including PHP, are seeing more and more attacks through taken-over accounts and stolen access tokens. In response we shipped a set of changes in quick succession:

-   Malware detection on Packagist.org, based on a feed provided by [Aikido](https://www.aikido.dev/)
-   A public transparency log of security-relevant events, funded by the Sovereign Tech Agency, which accurately recorded the tag modifications used in recent attacks
-   [Immutable stable versions](https://blog.packagist.com/immutable-versions-on-packagist/), so tagged releases can no longer be silently rewritten
-   Composer 2.10 with dependency policies that block malware, handle security advisories and report abandoned packages
-   Organization-wide supply chain controls in Private Packagist, such as enforcing a safe Composer version, restricting Composer plugins and blocking malware downloads for every Composer version

In July we also launched the [Composer & Packagist sponsorship program](https://blog.packagist.com/announcing-the-composer-packagist-sponsorship-program/). We are grateful to our launch sponsors and to everyone who joined since.

## What comes next

### Securing the supply chain

Our [supply chain security update](https://blog.packagist.com/an-update-on-composer-packagist-supply-chain-security/) laid out the roadmap for the coming months:

-   A minimum release age (cooldown) dependency policy in Composer 2.11, which holds back freshly published versions and gives malware detection a chance to catch malicious releases before they are installed
-   MFA events in the transparency log, MFA status on maintainer profiles, and eventually mandatory MFA for all Packagist.org accounts
-   Organizational package ownership, replacing shared company accounts with organizations that own packages and vendor prefixes while individual maintainers act on their behalf
-   A FIDO2-backed staged release flow for packages with large user bases
-   Immutable build artifacts hosted on Packagist.org, with build provenance and Sigstore attestations verified by Composer

We have some good news to share on that last point in a separate blog post in the next few days.

### Funding shared infrastructure

Operating Packagist.org around the clock, supporting maintainers, responding to attacks in the middle of the night, and building the features above is work done by people, and staff is by far our largest expense. For most of its history that was funded by one company.

The sponsorship program is a first step toward spreading that cost across the businesses that rely on Packagist.org, and it is not the end state. Together with other registries in the Linux Foundation's Sustaining Package Registries Working Group, we are working toward infrastructure and engineering subscriptions for the organizations that make the heaviest commercial use of Packagist.org, such as SaaS vendors distributing SDKs, private package repositories and bulk data consumers.

We are encouraged that large enterprises are starting to back this direction. Earlier this month Arm, Datadog, Dell Technologies, Ericsson, GitHub, Google, IBM, Kusari, Microsoft, Red Hat, the Rust Foundation and Sonatype signed the OpenSSF letter [We're In: Enterprise Commitment to Sustainable Package Registries](https://openssf.org/blog/2026/09/16/were-in-enterprise-commitment-to-sustainable-package-registries/). They commit to treating registry fees as an investment in security and resilience, and to supporting registries like Packagist as they explore enterprise funding models, while keeping access free for individual developers and small organizations.

Packagist.org stays free for individual developers and small and medium companies. If your company builds significant commercial value on Packagist.org, now is a good time to get in touch at [redacted@example.invalid](mailto:redacted@example.invalid) and help shape what these plans will look like.

## Thank you

Fifteen years ago we wanted to solve a problem for phpBB and Symfony. Today Composer and Packagist.org are part of nearly every PHP project. Thank you to all contributors, package maintainers, Private Packagist customers, sponsors and infrastructure partners, and to the Packagist team who keep everything running day and night.

Here is to the next fifteen years, and to more Korean dinners.

If you want to support Composer and Packagist.org, you can [become a sponsor](https://packagist.org/sponsor/), [subscribe to Private Packagist](https://packagist.com/), or support us individually through [GitHub Sponsors](https://github.com/sponsors/composer).
