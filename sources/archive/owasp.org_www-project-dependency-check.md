# OWASP Dependency-Check

Dependency-Check is a Software Composition Analysis (SCA) tool suite that identifies project dependencies and checks if there are any known, publicly disclosed, vulnerabilities.

[View on GitHub](https://github.com/dependency-check/DependencyCheck)[Documentation](https://dependency-check.github.io/DependencyCheck/)

## About OWASP Dependency-Check

### Introduction

[](#introduction "Copy link")

The OWASP Top 10 2013 contained a new entry: A9-Using Components with Known Vulnerabilities. Dependency-Check was created as one of the earliest SCA tools to scan applications (and their dependent libraries) and identify any known vulnerable components. The problem with using known vulnerable components was described very well in a paper by Jeff Williams and Arshan Dabirsiaghi titled, “Unfortunate Reality of Insecure Libraries”. The gist of the paper is that we as a development community include third party libraries in our applications that contain well known published vulnerabilities (such as those at the National Vulnerability Database). Dependency-Check has a command line interface, a Maven plugin, a Gradle plugin, an Ant task and a number of integrations with build tooling such as Jenkins, GitHub Actions and Azure DevOps. The core engine contains a series of analyzers that inspect the project dependencies, collect pieces of information about the dependencies (referred to as evidence within the tool). The evidence is then used to identify the Common Platform Enumeration (CPE) for the given dependency. If a CPE is identified, a listing of associated Common Vulnerability and Exposure (CVE) entries are listed in a report. Other 3rd party services and data sources such as the NPM Audit API, the OSS Index, RetireJS, and Bundler Audit are utilized for specific technologies. Dependency-Check automatically updates itself using the NVD Data Feeds hosted by NIST. ‘'’IMPORTANT NOTE:’’’ The initial download of the data may take ten minutes or more. If you run the tool at least once every seven days, only a small JSON file needs to be downloaded to keep the local copy of the data current.

[• Unfortunate Reality of Insecure Libraries](https://www.scribd.com/document/175866686/Aspect-Security-the-Unfortunate-Reality-of-Insecure-Libraries)

[• National Vulnerability Database](https://nvd.nist.gov/vuln/search)

[• Common Platform Enumeration (CPE)](https://nvd.nist.gov/products/cpe)

[• Common Vulnerability and Exposure (CVE)](https://www.cve.org/)

[• NVD Data Feeds](https://nvd.nist.gov/vuln/data-feeds)

### Project Resources

-   [Documentation](https://dependency-check.github.io/DependencyCheck/)
-   [GitHub](https://github.com/dependency-check/DependencyCheck)
-   [Unfortunate Reality of Insecure Libraries](https://cdn2.hubspot.net/hub/203759/file-1100864196-pdf/docs/Contrast_-_Insecure_Libraries_2014.pdf)
-   [National Vulnerability Database](https://nvd.nist.gov/vuln/search)
-   [Common Platform Enumeration (CPE)](https://nvd.nist.gov/products/cpe)
-   [Common Vulnerability and Exposure (CVE)](https://cve.mitre.org/)
-   [NVD Data Feeds](https://nvd.nist.gov/vuln/data-feeds)
-   [Command Line](https://github.com/dependency-check/DependencyCheck/releases/download/v12.1.0/dependency-check-12.1.0-release.zip)
-   [Ant Task](https://github.com/dependency-check/DependencyCheck/releases/download/v12.1.0/dependency-check-ant-12.1.0-release.zip)
-   [Maven Plugin](https://search.maven.org/#artifactdetails%7Corg.owasp%7Cdependency-check-maven%7C12.1.0%7Cmaven-plugin)
-   [Mac Homebrew](https://brew.sh/)
-   [Jenkins Plugin](https://plugins.jenkins.io/dependency-check-jenkins-plugin)
-   [lein-dependency-check](https://github.com/livingsocial/lein-dependency-check)
-   [SonarQube Plugin](https://github.com/SonarSecurityCommunity/dependency-check-sonar-plugin)
-   [Circle CI Orb](https://github.com/entur/owasp-orb)

### Project Leaders

#### Jeremy Long

[Email](mailto:jeremy.long@owasp.org)

### Project Information

🚩Flagship Project

Classification

🏷️Supply Chain

Language

Java

License

Apache License 2.0

Latest Version

13.0

Contributors

385

GitHub Stars

7728

Downloads

12837520

Corporate Supporters

[Become a Corporate Supporter](/supporters)[Meet our Corporate Supporters](/supporters/bios)[Supporter Job Postings](/supporters/jobs)

![OWASP Logo](/images/logos/owasp-logo-footer.svg?dpl=dpl_3j4eq6mqtrwFMk72RayntYttGhDS)

OWASP is a nonprofit foundation improving software security through open-source projects, global communities, and education. All resources are free and open to everyone.

Quick Links

[Awards](/awards)[Chapters](/chapters)[Community](/community)[Contact](/contact)[Corporate Supporters](/supporters)[Events](/events)[News](/news)[OWASP Community](https://community.owasp.org)[Projects](/projects)[Security](/security)[Staff](/staff)[OWASP Merch](https://cybersecgames.com/pages/owasp-merchandise)

Legal & Governance

[About OWASP](/about)[Board](/board)[Board EU](/board-eu)[Finance (all documents)](/finance)[Finance & Governance](/finance-governance)[Policies](/policy)[Impact Report 2025](/docs/OWASP-Impact-Report-2025.pdf)[Strategic Plan 2026](/docs/OWASP-Foundation-Strategic-Plan.pdf)

Socials

[Bluesky](https://bsky.app/profile/owasp.org)[GitHub](https://github.com/OWASP)[LinkedIn](https://www.linkedin.com/company/owasp/)[Mastodon](https://infosec.exchange/@owasp)[![](/images/logos/slack-logo.svg?dpl=dpl_3j4eq6mqtrwFMk72RayntYttGhDS)Slack](/slack/invite)[X](https://twitter.com/owasp)[YouTube](https://www.youtube.com/@OWASPGlobal)

[Make a Donation](/donate)[Join Now](https://owasp.glueup.com/organization/6727/memberships)[![](/images/logos/slack-logo.svg?dpl=dpl_3j4eq6mqtrwFMk72RayntYttGhDS)Join Slack](/slack/invite)

OWASP, the OWASP logo, and Global AppSec are registered trademarks and AppSec Days, AppSec California, AppSec Cali, SnowFROC, OWASP Boston Application Security Conference, and LASCON are trademarks of the OWASP Foundation, Inc.

© 2026, OWASP Foundation Inc. All rights reserved.
