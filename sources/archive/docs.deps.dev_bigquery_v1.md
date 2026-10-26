## deps.dev BigQuery dataset

## Overview

The deps.dev BigQuery dataset provides signals that both maintainers and consumers of open-source software (OSS) can use to improve the health of their software.

The dataset is provided as a [BigQuery public dataset](https://cloud.google.com/bigquery/public-data).

-   [Get started](#getting-started) with this dataset
    -   [Prerequisites](#prerequisites)
    -   [Sample queries](#sample-queries)
-   Detailed [schema of the available tables](#schema)
    -   [Advisories](#advisories)
    -   [AdvisoriesLatest](#advisorieslatest)
    -   [Dependencies](#dependencies)
    -   [DependenciesLatest](#dependencieslatest)
    -   [DependencyGraphEdges](#dependencygraphedges)
    -   [DependencyGraphEdgesLatest](#dependencygraphedgeslatest)
    -   [Dependents](#dependents)
    -   [DependentsLatest](#dependentslatest)
    -   [NuGetRequirements](#nugetrequirements)
    -   [NuGetRequirementsLatest](#nugetrequirementslatest)
    -   [RubyGemsRequirements](#rubygemsrequirements)
    -   [RubyGemsRequirementsLatest](#rubygemsrequirementslatest)
    -   [NPMRequirements](#npmrequirements)
    -   [NPMRequirementsLatest](#npmrequirementslatest)
    -   [MavenRequirements](#mavenrequirements)
    -   [MavenRequirementsLatest](#mavenrequirementslatest)
    -   [PyPIRequirements](#pypirequirements)
    -   [PyPIRequirementsLatest](#pypirequirementslatest)
    -   [CargoRequirements](#cargorequirements)
    -   [CargoRequirementsLatest](#cargorequirementslatest)
    -   [PackageVersionHashes](#packageversionhashes)
    -   [PackageVersionHashesLatest](#packageversionhasheslatest)
    -   [PackageVersionToProject](#packageversiontoproject)
    -   [PackageVersionToProjectLatest](#packageversiontoprojectlatest)
    -   [PackageVersions](#packageversions)
    -   [PackageVersionsLatest](#packageversionslatest)
    -   [Projects](#projects)
    -   [ProjectsLatest](#projectslatest)
    -   [Snapshots](#snapshots)
    -   [GoRequirements](#gorequirements)
    -   [GoRequirementsLatest](#gorequirementslatest)
-   [Data](#data)
-   [Contact us](#contact-us)

## Getting started

### Prerequisites

To use the BigQuery dataset, you will need a Google Cloud account with the BigQuery API enabled. If you already use BigQuery, feel free to skip this section.

1.  Sign in to your Google Cloud account. If you’re new to Google Cloud, [create an account](https://console.cloud.google.com/freetrial).
    
2.  In the Google Cloud console, on the project selector page, select or [create a Google Cloud project](https://cloud.google.com/resource-manager/docs/creating-managing-projects).
    
3.  Ensure the [BigQuery API](https://console.cloud.google.com/flows/enableapi?apiid=bigquery) is enabled. It will be enabled by default in new projects.
    
4.  Optional: [Enable billing](https://cloud.google.com/billing/docs/how-to/modify-project) for the project. You will not necessarily be charged because BigQuery provides a free usage tier detailed in the [pricing documentation](https://cloud.google.com/bigquery/pricing). If you do not want to enable billing, you can still explore the data using the [BigQuery sandbox](https://cloud.google.com/bigquery/docs/sandbox), but some queries will fail if the sandbox cannot guarantee they will be below the free usage limits.
    
5.  Optional: Get familiar with [BigQuery in the Google Cloud console](https://cloud.google.com/bigquery/docs/bigquery-web-ui), how to [query public datasets](https://cloud.google.com/bigquery/docs/quickstarts/query-public-dataset-console) and the fundamentals of [BigQuery analytics](https://cloud.google.com/bigquery/docs/query-overview).
    

### Sample queries

This section contains sample queries that demonstrate some of the ways the dataset can be used.

Using the [BigQuery Sandbox](https://cloud.google.com/bigquery/docs/sandbox) it is possible to run small queries and preview table contents without providing a credit card or setting up a billing account. See the [prerequisites](#prerequisites) for more details.

#### Find advisories by package version

This example demonstrates searching for advisories that disclose vulnerabilities in a set of package versions, such as the dependencies of your application. Using one of the [BigQuery client libraries](https://cloud.google.com/bigquery/docs/reference/libraries) this type of query could be integrated into an automated test for known vulnerabilities in your project’s dependencies.

First we will construct a temporary table that contains the set of package versions that we wish to query. Then to gather the advisories that affected them we join the [PackageVersionsLatest](#packageversionslatest) view with our temporary table. We will also use the [comma operator](https://cloud.google.com/bigquery/docs/reference/standard-sql/arrays#flattening_arrays) to unnest the list of advisories that may affect each of these package versions.

```
CREATE TEMP TABLE Packages (
  System string,
  Name string,
  Version string)
CLUSTER BY
  System,
  Name,
  Version;

INSERT INTO Packages
VALUES ('NPM', 'react', '16.0.0'),
       ('NPM', 'react-dom', '16.0.0'),
       ('NPM', 'react-is', '16.13.1'),
       ('NPM', 'react-router', '5.2.1'),
       ('NPM', 'qs', '6.3.1'),
       ('NPM', 'send', '0.1.0');

SELECT
  p.System,
  p.Name,
  p.Version,
  Advisory
FROM
  `bigquery-public-data.deps_dev_v1.PackageVersionsLatest` AS p,
  p.Advisories AS Advisory
JOIN
  Packages
USING
  (System, Name, Version);
```

In addition to the source and id of each advisory we can fetch its severity and title. To do this we will join with the [AdvisoriesLatest](#advisorieslatest) view, and aggregate the advisories that affect a single package version into an array of records.

```
CREATE TEMP TABLE Packages (
  System string,
  Name string,
  Version string)
CLUSTER BY
  System,
  Name,
  Version;

INSERT INTO Packages
VALUES ('NPM', 'react', '16.0.0'),
       ('NPM', 'react-dom', '16.0.0'),
       ('NPM', 'react-is', '16.13.1'),
       ('NPM', 'react-router', '5.2.1'),
       ('NPM', 'qs', '6.3.1'),
       ('NPM', 'send', '0.1.0');

SELECT
  p.System,
  p.Name,
  p.Version,
  ARRAY_AGG(
    STRUCT(
      a.Source,
      a.SourceID,
      a.Title,
      a.Severity,
      a.GitHubSeverity)) AS Advisories
FROM
  `bigquery-public-data.deps_dev_v1.PackageVersionsLatest` AS p,
  p.Advisories AS Advisory
JOIN
  Packages
USING
  (System, Name, Version)
JOIN
  `bigquery-public-data.deps_dev_v1.AdvisoriesLatest` AS a
ON
  a.Source = Advisory.Source
  AND a.SourceID = Advisory.SourceID
GROUP BY
  System,
  Name,
  Version;
```

#### Find licenses by package version

This example demonstrates searching for a set of licenses used by a set of package versions. Like in the [previous example](#find-advisories-by-package-version) this set of package versions may be you application’s dependencies, and you may wish to check the licenses are compatible with your products distribution.

The query has a very similar structure to that used in the previous example. The license information is taken from the [PackageVersionsLatest](#packageversionslatest) view. But in this query there is no need to join with the Advisories table.

```
CREATE TEMP TABLE Packages (
  System string,
  Name string,
  Version string)
CLUSTER BY
  System,
  Name,
  Version;

INSERT INTO Packages
VALUES ('NPM', 'react', '16.0.0'),
       ('NPM', 'react-dom', '16.0.0'),
       ('NPM', 'react-is', '16.13.1'),
       ('NPM', 'react-router', '5.2.1'),
       ('NPM', 'qs', '6.3.1'),
       ('NPM', 'send', '0.1.0');

SELECT
  License,
  ARRAY_AGG(
    STRUCT(
      p.System,
      p.Name,
      p.Version)) AS Packages
FROM
  `bigquery-public-data.deps_dev_v1.PackageVersionsLatest` AS p,
  p.Licenses AS License
JOIN
  Packages
USING
  (System, Name, Version)
GROUP BY
  License;
```

#### Finding common licenses

This example computes the three most common licenses per system. It is intended to demonstrate simple ecosystem-wide analysis with the deps.dev dataset.

Each version of each package can specify multiple licenses. This is found in the [PackageVersions](#packageversions) table which contains a column ‘Licenses’ containing an array of licenses. To count the number of distinct packages using each license within each system we unnest the array and count the distinct package names among the resulting rows:

```
SELECT
  p.System,
  License,
  COUNT(DISTINCT p.Name) AS NPackages
FROM
  `bigquery-public-data.deps_dev_v1.PackageVersionsLatest` AS p,
  p.Licenses AS License
GROUP BY
  System,
  License;
```

If we wish to see just the top 3 licenses per system we can make use of BigQuery’s [window functions](https://cloud.google.com/bigquery/docs/reference/standard-sql/window-function-calls) to compute a ranking:

```
WITH
  Counts AS (
    SELECT
      p.System,
      License,
      COUNT(DISTINCT p.Name) AS NPackages
    FROM
      `bigquery-public-data.deps_dev_v1.PackageVersionsLatest` AS p,
      p.Licenses AS License
    GROUP BY
      System,
      License),

  Ranked AS (
    SELECT
      System,
      License,
      NPackages,
      ROW_NUMBER()
        OVER (PARTITION BY System ORDER BY NPackages DESC) AS LicenseRank
    FROM
      Counts)

SELECT
  System,
  License,
  NPackages
FROM
  Ranked
WHERE
  LicenseRank <= 3
ORDER BY
  System,
  LicenseRank;
```

#### Direct importers of a package

Using the [NuGetRequirementsLatest](#nugetrequirementslatest) view we can determine which NuGet packages have specified a given package as a requirement.

For ecosystems where dependencies are supported, you can use the [DependentsLatest](#dependentslatest) view instead to find importers of a package.

```
DECLARE
  PackageName STRING DEFAULT 'castle.core';

SELECT
  R.Name AS Importer,
  R.Version As ImporterVersion,
  DG.TargetFramework,
  RS.Requirement
FROM
  `deps-dev-insights.v1.NuGetRequirementsLatest` AS R
CROSS JOIN
  UNNEST(R.DependencyGroups) AS DG
CROSS JOIN
  UNNEST(DG.Dependencies) AS RS
WHERE
  RS.Name = PackageName
ORDER BY
  Importer,
  ImporterVersion,
  RS.Requirement,
  DG.TargetFramework;
```

#### Dependent count

Using the dependency graphs we can determine which packages have the most dependents within their ecosystem.

In order to compute a count that reflects the current state of the ecosystem we only count the highest release of each package. Here ‘highest’ is determined by the order defined by [semantic versioning](https://semver.org) or the system equivalent. So our query will first filter the set of all available package versions to just the highest release per version. This can be achieved by making use of the VersionInfo column in the [PackageVersions](#packageversions) table. This column contains information extracted from the version string, allowing us to know which versions are releases and the position of each version in the ordered list of all versions for the corresponding package.

```
DECLARE
  Sys STRING DEFAULT 'CARGO';

SELECT
  Name,
  Version,
FROM (
  SELECT
    Name,
    Version,
    ROW_NUMBER()
      OVER (PARTITION BY
              Name
            ORDER BY
              VersionInfo.Ordinal DESC) AS RowNumber
    FROM
      `bigquery-public-data.deps_dev_v1.PackageVersionsLatest`
    WHERE
      System = Sys
      AND VersionInfo.IsRelease)
WHERE RowNumber = 1;
```

We will count how many of these ‘highest release’ versions depend on each version available. This can be achieved by using the [Dependencies](#dependencies) table which contains a relation between pairs of package versions, representing the transitive closure of each dependency graph.

```
DECLARE
  Sys STRING DEFAULT 'CARGO';

WITH
  HighestReleases AS (
    SELECT
      Name,
      Version,
    FROM (
      SELECT
        Name,
        Version,
        ROW_NUMBER()
          OVER (PARTITION BY
                  Name
                ORDER BY
                  VersionInfo.Ordinal DESC) AS RowNumber
        FROM
          `bigquery-public-data.deps_dev_v1.PackageVersionsLatest`
        WHERE
          System = Sys
          AND VersionInfo.IsRelease)
    WHERE RowNumber = 1)

SELECT
  D.Dependency.Name,
  D.Dependency.Version,
  COUNT(*) AS NDependents
FROM
  `bigquery-public-data.deps_dev_v1.DependenciesLatest` AS D
JOIN
  HighestReleases AS H
USING
  (Name, Version)
WHERE
  D.System = Sys
GROUP BY
  D.Dependency.Name,
  D.Dependency.Version
ORDER BY
  NDependents DESC
LIMIT
  10;
```

## Schema

This section describes the schema used for the tables and views in the dataset.

### Advisories

This table stores information about security advisories related to packages from any of npm, Go, Maven, PyPI, Cargo and NuGet. Each row represents a single advisory and can be identified by Source and SourceID.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Source: STRING (REQUIRED)

The upstream source of this advisory, example values include 'GHSA', 'NSWG' and 'OSV'.

SourceID: STRING (REQUIRED)

The id of this advisory within its upstream source.

SourceURL: STRING (REQUIRED)

A link to this advisory in its upstream source.

Title: STRING

Brief human-readable description of the advisory.

Description: STRING

A description of the advisory.

ReferenceURLs: STRING (REPEATED)

URLs that elaborate on an advisory: longer descriptions, corroborating evidence, patches, issue trackers, release notes and so on.

CVSS3Score: NUMERIC

A numeric measure of severity according to the CVSS3 spec. The measure ranges from 0-10 and is to 1 decimal place.

Severity: STRING

A discrete scale of the severity, derived from the CVSS3Score. Example values include 'NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'.

GitHubSeverity: STRING

The severity of this advisory as determined by GitHub. Example values include 'LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'UNKNOWN'.

Disclosed: TIMESTAMP

The time at which this advisory was publicly disclosed.

Aliases: STRING (REPEATED)

Other identifiers used for the advisory, including CVEs.

Packages: RECORD (REPEATED)

An array of the packages affected by this advisory.

Packages.System: STRING (REQUIRED)

The system of the affected package

Packages.Name: STRING (REQUIRED)

The name of the affected package

Packages.AffectedVersions: STRING (REQUIRED)

The versions of the package affected by the advisory

Packages.UnaffectedVersions: STRING (REQUIRED)

The versions of the package unaffected by the advisory

### AdvisoriesLatest

This view contains the most recent snapshot in the Advisories table.

### Dependencies

This table stores information about the dependency relationship between versions of packages. Each row represents a dependency of one package version importing (depending on) another. These dependencies include both direct and indirect dependencies.

The dependencies are determined by computing a resolution of the requirements (dependency constraints) specified by a version. Each dependency graph should be similar to one produced by installing the corresponding package version on a generic 64-bit Linux system, with no other dependencies present. The precise meaning of this varies from system to system.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

System: STRING (REQUIRED)

The dependency management system of the importing package version in the relation.

Name: STRING (REQUIRED)

The name of the importing package version in the relation.

Version: STRING (REQUIRED)

The version of the importing package version in the relation.

Dependency: RECORD (REQUIRED)

The imported package version.

Dependency.System: STRING (REQUIRED)

The system of the imported package version.

Dependency.Name: STRING (REQUIRED)

The name of the imported package version.

Dependency.Version: STRING (REQUIRED)

The version of the imported package version.

MinimumDepth: INTEGER

The minimum depth of this dependency from the root.

### DependenciesLatest

This view contains the most recent snapshot in the Dependencies table.

### DependencyGraphEdges

This table stores the full dependency graph for each version of each package. Each row represents one edge in a dependency graph. Dependency graphs are only available for npm, Go, Maven, PyPI and Cargo.

The dependency graphs are determined by computing a resolution of the requirements (dependency constraints) specified by a version. Each dependency graph should be similar to one produced by installing the package version on a generic 64-bit Linux system, with no other dependencies present. The precise meaning of this varies from system to system.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

System: STRING (REQUIRED)

The dependency management system of the package version at the root of the dependency graph.

Name: STRING (REQUIRED)

The name of the package version at the root of the dependency graph.

Version: STRING (REQUIRED)

The version of the package version at the root of the dependency graph.

Requirement: STRING (REQUIRED)

A string to represent how this particular dependency was required. Its format is system specific.

From: RECORD (REQUIRED)

The importing package version.

From.System: STRING (REQUIRED)

The system of the importing package version.

From.Name: STRING (REQUIRED)

The name of the importing package version.

From.Version: STRING (REQUIRED)

The version of the importing package version.

To: RECORD (REQUIRED)

The imported package version.

To.System: STRING (REQUIRED)

The system of the imported package version.

To.Name: STRING (REQUIRED)

The name of the imported package version.

To.Version: STRING (REQUIRED)

The version of the imported package version.

### DependencyGraphEdgesLatest

This view contains the most recent snapshot in the DependencyGraphEdges table.

### Dependents

This table stores information about the dependency relationship between versions of packages. Each row represents a dependency of one package version importing (depending on) another. These dependencies include both direct and indirect dependencies.

The table is clustered on the System, Name and Version of the imported package, allowing for efficient lookup of all versions of all packages that import a specific version of a package. Dependents are only available for npm, Go, Maven, PyPI and Cargo.

The dependent relation is computed by inverting the data in the Dependencies table.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

System: STRING (REQUIRED)

The dependency management system of the imported package version in the relation.

Name: STRING (REQUIRED)

The name of the imported package version in the relation.

Version: STRING (REQUIRED)

The version of the imported package version in the relation.

Dependent: RECORD (REQUIRED)

The importing package version.

Dependent.System: STRING (REQUIRED)

The system of the importing package version.

Dependent.Name: STRING (REQUIRED)

The name of the importing package version.

Dependent.Version: STRING (REQUIRED)

The version of the importing package version.

MinimumDepth: INTEGER

The minimum depth of this dependency from the root.

DependentIsHighestReleaseWithResolution: BOOLEAN

This value is true if the version of the dependent was the highest release of the respective package with a dependency resolution available at the time of snapshot.

### DependentsLatest

This view contains the most recent snapshot in the Dependents table.

### NuGetRequirements

This table stores the requirements for NuGet package versions. Note that the term ‘dependency’ is used within this table to mean ‘a single unresolved requirement’ to be consistent with how the term is used in the NuGet ecosystem. This is different to how it is used elsewhere in this schema.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

DependencyGroups: RECORD (REPEATED)

The list of requirements grouped by target framework.

DependencyGroups.TargetFramework: STRING (REQUIRED)

The target framework that this dependency group is for.

DependencyGroups.Dependencies: RECORD (REPEATED)

The requirements for this dependency group.

DependencyGroups.Dependencies.Name: STRING (REQUIRED)

The name of the package.

DependencyGroups.Dependencies.Requirement: STRING (REQUIRED)

The requirement on the package.

DependencyGroups.Dependencies.Include: STRING (NULLABLE)

Assets to include from this dependency into the consuming project.

DependencyGroups.Dependencies.Exclude: STRING (NULLABLE)

Assets to exclude from this dependency when consumed by a project.

DevelopmentDependency: BOOLEAN

Whether this package is allowed to be included in the consumer's development dependencies list only.

FrameworkAssemblies: RECORD (REPEATED)

FrameworkAssembly is a platform dependency. It references DLLs that this package expects to be present on the consumer's .NET Framework installation.

FrameworkAssemblies.AssemblyName: STRING (REQUIRED)

The assembly name.

FrameworkAssemblies.TargetFramework: STRING (REQUIRED)

The target framework for which this assembly reference applies to.

FrameworkReferences: RECORD (REPEATED)

FrameworkReferences is like FrameworkAssembly but it references DLLs that are expected on the consumer's installation of the .NET Core or .NET 5+.

FrameworkReferences.Name: STRING (REQUIRED)

The reference name.

FrameworkReferences.TargetFramework: STRING (REQUIRED)

The target framework for which this reference applies to.

### NuGetRequirementsLatest

This view contains the most recent snapshot in the NuGetRequirements table.

### RubyGemsRequirements

This table stores the requirements for RubyGems package versions.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

RuntimeDependencies: RECORD (REPEATED)

The list of runtime dependencies. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the RubyGems ecosystem. This is different to how it is used elsewhere in this dataset.

RuntimeDependencies.Name: STRING (REQUIRED)

The name of the package.

RuntimeDependencies.Requirement: STRING (REQUIRED)

The requirement on the package.

DevDependencies: RECORD (REPEATED)

The list of development dependencies. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the RubyGems ecosystem. This is different to how it is used elsewhere in this dataset.

DevDependencies.Name: STRING (REQUIRED)

The name of the package.

DevDependencies.Requirement: STRING (REQUIRED)

The requirement on the package.

RequiredRubyVersion: STRING

Semver requirement string for Ruby version.

RequiredRubygemsVersion: STRING

Semver requirement string for Rubygems version.

### RubyGemsRequirementsLatest

This view contains the most recent snapshot in the RubyGemsRequirements table.

### NPMRequirements

This table stores the requirements for NPM package versions.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

Dependencies: RECORD (REPEATED)

The list of dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

Dependencies.Name: STRING (REQUIRED)

The name of the package.

Dependencies.Requirement: STRING (REQUIRED)

The requirement on the package.

DevDependencies: RECORD (REPEATED)

The list of development dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

DevDependencies.Name: STRING (REQUIRED)

The name of the development-only package.

DevDependencies.Requirement: STRING (REQUIRED)

The requirement on the development-only package.

OptionalDependencies: RECORD (REPEATED)

The list of optional dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

OptionalDependencies.Name: STRING (REQUIRED)

The name of the optional package.

OptionalDependencies.Requirement: STRING (REQUIRED)

The requirement on the optional package.

PeerDependencies: RECORD (REPEATED)

The list of peer dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

PeerDependencies.Name: STRING (REQUIRED)

The name of the peer package.

PeerDependencies.Requirement: STRING (REQUIRED)

The requirement on the peer package.

PeerDependencyMetadata: RECORD (REPEATED)

Peer Dependency Metadata with optional boolean

PeerDependencyMetadata.Name: STRING (REQUIRED)

The name of the package.

PeerDependencyMetadata.Optional: BOOLEAN (REQUIRED)

Whether it's optional.

BundledDependencies: STRING (REPEATED)

The list of package names that are bundled when the package is published.

Bundles: RECORD (REPEATED)

The list of dependencies this package version bundles.

Bundles.Path: STRING (REQUIRED)

The path of the bundled package.

Bundles.Name: STRING (REQUIRED)

The name of the bundled package.

Bundles.Version: STRING (REQUIRED)

The version of the bundled package.

Bundles.Dependencies: RECORD (REPEATED)

The list of dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

Bundles.Dependencies.Name: STRING (REQUIRED)

The name of the package.

Bundles.Dependencies.Requirement: STRING (REQUIRED)

The requirement on the package.

Bundles.DevDependencies: RECORD (REPEATED)

The list of development dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

Bundles.DevDependencies.Name: STRING (REQUIRED)

The name of the development-only package.

Bundles.DevDependencies.Requirement: STRING (REQUIRED)

The requirement on the development-only package.

Bundles.OptionalDependencies: RECORD (REPEATED)

The list of optional dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

Bundles.OptionalDependencies.Name: STRING (REQUIRED)

The name of the optional package.

Bundles.OptionalDependencies.Requirement: STRING (REQUIRED)

The requirement on the optional package.

Bundles.PeerDependencies: RECORD (REPEATED)

The list of peer dependencies this package version has. Note that the term 'dependency' is used here to mean 'a single unresolved requirement' to be consistent with how the term is used in the npm ecosystem. This is different to how it is used elsewhere in this dataset.

Bundles.PeerDependencies.Name: STRING (REQUIRED)

The name of the peer package.

Bundles.PeerDependencies.Requirement: STRING (REQUIRED)

The requirement on the peer package.

Bundles.PeerDependencyMetadata: RECORD (REPEATED)

The list of peer dependency metadata including name and whether optional.

Bundles.PeerDependencyMetadata.Name: STRING (REQUIRED)

The name of the peer package.

Bundles.PeerDependencyMetadata.Optional: BOOLEAN (REQUIRED)

Whether it's optional.

Bundles.BundledDependencies: STRING (REPEATED)

The list of package names that are bundled when the package is published.

OS: STRING (REPEATED)

The list of operating systems that this package version supports.

CPU: STRING (REPEATED)

The list of CPUs that this package version supports.

### NPMRequirementsLatest

This view contains the most recent snapshot in the NPMRequirements table.

### MavenRequirements

This table stores the requirements for Maven package versions.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

Parent: RECORD

The direct parent of a package version.

Parent.System: STRING

Parent.Name: STRING

Parent.Version: STRING

Dependencies: RECORD (REPEATED)

Direct dependencies.

Dependencies.Name: STRING

Dependencies.Version: STRING

Dependencies.Scope: STRING

Dependencies.Type: STRING

Dependencies.Classifier: STRING

Dependencies.Optional: STRING

Dependencies.Exclusions: STRING (REPEATED)

Dependencies.ResolvedName: STRING

Dependencies.ResolvedVersion: STRING

Dependencies.ResolvedScope: STRING

Dependencies.ResolvedType: STRING

Dependencies.ResolvedClassifier: STRING

Dependencies.ResolvedOptional: STRING

Dependencies.Origin: STRING

DependencyManagement: RECORD (REPEATED)

Dependency management.

DependencyManagement.Name: STRING

DependencyManagement.Version: STRING

DependencyManagement.Scope: STRING

DependencyManagement.Type: STRING

DependencyManagement.Classifier: STRING

DependencyManagement.Optional: STRING

DependencyManagement.Exclusions: STRING (REPEATED)

DependencyManagement.ResolvedName: STRING

DependencyManagement.ResolvedVersion: STRING

DependencyManagement.ResolvedScope: STRING

DependencyManagement.ResolvedType: STRING

DependencyManagement.ResolvedClassifier: STRING

DependencyManagement.ResolvedOptional: STRING

DependencyManagement.Origin: STRING

Properties: RECORD (REPEATED)

Properties.

Properties.Name: STRING

Properties.Value: STRING

Repositories: RECORD (REPEATED)

Repositories.

Repositories.ID: STRING

Repositories.URL: STRING

Repositories.Layout: STRING

Repositories.ReleasesEnabled: STRING

Repositories.SnapshotsEnabled: STRING

Repositories.ResolvedURL: STRING

Profiles: RECORD (REPEATED)

Profiles.

Profiles.ID: STRING

Profiles.Activation: RECORD

Profiles.Activation.ActiveByDefault: STRING

Profiles.Activation.JDK: RECORD

Profiles.Activation.JDK.JDK: STRING

Profiles.Activation.OS: RECORD

Profiles.Activation.OS.Name: STRING

Profiles.Activation.OS.Family: STRING

Profiles.Activation.OS.Arch: STRING

Profiles.Activation.OS.Version: STRING

Profiles.Activation.Property: RECORD

Profiles.Activation.Property.Name: STRING

Profiles.Activation.Property.Value: STRING

Profiles.Activation.File: RECORD

Profiles.Activation.File.Exists: STRING

Profiles.Activation.File.Missing: STRING

Profiles.Dependencies: RECORD (REPEATED)

Profiles.Dependencies.Name: STRING

Profiles.Dependencies.Version: STRING

Profiles.Dependencies.Scope: STRING

Profiles.Dependencies.Type: STRING

Profiles.Dependencies.Classifier: STRING

Profiles.Dependencies.Optional: STRING

Profiles.Dependencies.Exclusions: STRING (REPEATED)

Profiles.Dependencies.ResolvedName: STRING

Profiles.Dependencies.ResolvedVersion: STRING

Profiles.Dependencies.ResolvedScope: STRING

Profiles.Dependencies.ResolvedType: STRING

Profiles.Dependencies.ResolvedClassifier: STRING

Profiles.Dependencies.ResolvedOptional: STRING

Profiles.Dependencies.Origin: STRING

Profiles.DependencyManagement: RECORD (REPEATED)

Profiles.DependencyManagement.Name: STRING

Profiles.DependencyManagement.Version: STRING

Profiles.DependencyManagement.Scope: STRING

Profiles.DependencyManagement.Type: STRING

Profiles.DependencyManagement.Classifier: STRING

Profiles.DependencyManagement.Optional: STRING

Profiles.DependencyManagement.Exclusions: STRING (REPEATED)

Profiles.DependencyManagement.ResolvedName: STRING

Profiles.DependencyManagement.ResolvedVersion: STRING

Profiles.DependencyManagement.ResolvedScope: STRING

Profiles.DependencyManagement.ResolvedType: STRING

Profiles.DependencyManagement.ResolvedClassifier: STRING

Profiles.DependencyManagement.ResolvedOptional: STRING

Profiles.DependencyManagement.Origin: STRING

Profiles.Properties: RECORD (REPEATED)

Profiles.Properties.Name: STRING

Profiles.Properties.Value: STRING

Profiles.Repositories: RECORD (REPEATED)

Profiles.Repositories.ID: STRING

Profiles.Repositories.URL: STRING

Profiles.Repositories.Layout: STRING

Profiles.Repositories.ReleasesEnabled: STRING

Profiles.Repositories.SnapshotsEnabled: STRING

Profiles.Repositories.ResolvedURL: STRING

### MavenRequirementsLatest

This view contains the most recent snapshot in the MavenRequirements table.

### PyPIRequirements

This table stores the requirements for PyPI package versions.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

Dependencies: RECORD (REPEATED)

The list of dependencies this package version has.

Dependencies.ProjectName: STRING (REQUIRED)

The name of the package.

Dependencies.Extras: STRING

The extras enabled for this dependency.

Dependencies.VersionSpecifier: STRING

The version requirement for this dependency.

Dependencies.EnvironmentMarker: STRING

The environment marker for this dependency.

ExternalDependencies: RECORD (REPEATED)

The list of external dependencies this package version has.

ExternalDependencies.Name: STRING (REQUIRED)

The name of the external dependency.

ExternalDependencies.VersionSpecifier: STRING

The version requirement for this external dependency.

ExternalDependencies.EnvironmentMarker: STRING

The environment marker for this external dependency.

ProvidedExtras: RECORD (REPEATED)

The list of extras this package provides.

ProvidedExtras.Name: STRING (REQUIRED)

The name of the extra.

RequiredPythonVersion: STRING

The required python version for this package version.

### PyPIRequirementsLatest

This view contains the most recent snapshot in the PyPIRequirements table.

### CargoRequirements

This table stores the requirements for Cargo package versions.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

Dependencies: RECORD (REPEATED)

The list of dependencies this package version has.

Dependencies.Name: STRING (REQUIRED)

The name of the dependency.

Dependencies.Requirement: STRING

The version requirement for the crate (e.g., '1.0', '=1.2.3').

Dependencies.Kind: STRING

Whether this is a normal dependency, dev-dependency, or build-dependency.

Dependencies.Optional: BOOLEAN

Whether this is an optional dependency.

Dependencies.PackageAlias: STRING

The alias for the package, if any.

Dependencies.UsesDefaultFeatures: BOOLEAN

Whether the dependency uses default features.

Dependencies.Features: STRING (REPEATED)

Features that are enabled on this dependency.

Dependencies.Target: STRING

If present, then this dependency is specific to a given platform.

Features: RECORD (REPEATED)

The list of features this package provides.

Features.Name: STRING (REQUIRED)

The name of the feature.

Features.Implies: STRING (REPEATED)

List of other features or dependencies that this feature would then enable.

### CargoRequirementsLatest

This view contains the most recent snapshot in the CargoRequirements table.

### PackageVersionHashes

This table can be used to find package versions from a given hash. Each row represents a single (hash, package version) pair.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Hash: STRING (REQUIRED)

A base64 encoded string of the hash.

HashType: STRING (REQUIRED)

The type of hash, example values include 'SHA512' and 'SHA1'.

System: STRING (REQUIRED)

The dependency management system of the package version.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

### PackageVersionHashesLatest

This view contains the most recent snapshot in the PackageVersionHashes table.

### PackageVersionToProject

This table represents the relation between package versions and project. Each row represents a single pair of package version and project. This relation is not guaranteed to be authoritative as the owner of a package may list a link to any project and the resulting relationship is not verified.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

System: STRING (REQUIRED)

The dependency management system of the package version.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

ProjectType: STRING (REQUIRED)

The type of the project.

ProjectName: STRING (REQUIRED)

The name of the project.

RelationProvenance: STRING

How the mapping between project and package version was discovered.

RelationType: STRING

What the relationship between the project and the package version is.

### PackageVersionToProjectLatest

This view contains the most recent snapshot in the PackageVersionToProject table.

### PackageVersions

This table stores information about specific versions of packages. Each row represents a single version of a package.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

System: STRING (REQUIRED)

The dependency management system of the package version.

Name: STRING (REQUIRED)

The name of the package version.

Version: STRING (REQUIRED)

The version of the package version.

Purl: STRING

The purl representing the package version.

Licenses: STRING (REPEATED)

An array of the licenses used by this package version, presented as SPDX expressions.

Description: STRING

The description the package provides - potentially text, HTML or markdown.

Deprecated: STRING

Set if the version has been marked as deprecated upstream.

ProjectStatus: STRING

The status of the project this package version belongs to.

ProjectStatusReason: STRING

The reason for the project status.

Registries: STRING (REPEATED)

An array of the package management registries this package version is available from.

Links: RECORD (REPEATED)

An array of links related to this package version, each consisting of a Label and URL.

Links.Label: STRING (REQUIRED)

A label for the corresponding URL value. Example values include 'DOCUMENTATION', 'ISSUE\_TRACKER', 'HOMEPAGE' and 'SOURCE\_REPO'.

Links.URL: STRING (REQUIRED)

The URL value.

Advisories: RECORD (REPEATED)

An array of Advisories that affect this package version directly. This can be used to join against the Advisories table.

Advisories.Source: STRING (REQUIRED)

The upstream source of this advisory, example values include 'OSV', 'GHSA' and 'NSWG'.

Advisories.SourceID: STRING (REQUIRED)

The id of this advisory within its upstream source.

VersionInfo: RECORD

Information extracted from the string value in the Version column of this row.

VersionInfo.IsRelease: BOOLEAN (REQUIRED)

The value is true if the version is considered a release, as opposed to a pre-release.

VersionInfo.Ordinal: INTEGER (REQUIRED)

The value allows the versions of a package to be sorted in semantic order without parsing the version string. If a package has its versions sorted in ascending order by VersionInfo.Ordinal, the order will correspond to the order of the version strings as determined by the package management system.

Hashes: RECORD (REPEATED)

An array of hashes that have been observed from this package version.

Hashes.Type: STRING (REQUIRED)

The type of hash, example values include 'SHA512' and 'SHA1'.

Hashes.Hash: STRING (REQUIRED)

A base64 encoded string of the hash.

UpstreamPublishedAt: TIMESTAMP

The time at which this package version was published, as reported by the upstream source.

UpstreamIdentifiers: RECORD (REPEATED)

Non-normalized upstream identifiers encountered when syncing this package version.

UpstreamIdentifiers.PackageName: STRING

The non-normalized package name string.

UpstreamIdentifiers.VersionString: STRING

The non-normalized version string.

UpstreamIdentifiers.Source: STRING (REQUIRED)

The upstream source for this identifier.

SLSAProvenance: RECORD

Provenance information for this package version. Extracted from a SLSA provenance attestation. This is only populated for npm package versions. See the 'Attestations' column for more attestations (including SLSA provenance) for all systems.

SLSAProvenance.SourceRepository: STRING (REQUIRED)

The source code repository used to build this version.

SLSAProvenance.Commit: STRING (REQUIRED)

The commit of the source code repository the version was built from.

SLSAProvenance.URL: STRING (REQUIRED)

The URL of the provenance statement.

SLSAProvenance.Verified: BOOLEAN (REQUIRED)

The Sigstore bundle containing this attestation was verified using the \[sigstore-go\](https://github.com/sigstore/sigstore-go) library.

Attestations: RECORD (REPEATED)

Attestations for this package version. Fields are populated based on Type

Attestations.Type: STRING (REQUIRED)

The type of attestation. One of https://slsa.dev/provenance/v0.2, https://slsa.dev/provenance/v1, https://docs.pypi.org/attestations/publish/v1.

Attestations.URL: STRING (REQUIRED)

The URL of the attestation.

Attestations.Verified: BOOLEAN

The attestation has been cryptographically verified by deps.dev. For attestations distributed in a Sigstore bundle, this field indicates the bundle was verified using the \[sigstore-go\](https://github.com/sigstore/sigstore-go) library.

Attestations.SourceRepository: STRING

The source code repository used to build this version if provided by the attestation.

Attestations.Commit: STRING

The commit of the source code repository the version was built from if provided by the attestation.

DependenciesProcessed: BOOLEAN

True if this version's dependency requirements have been processed.

DependencyError: BOOLEAN

True if an error was encountered while processing this version's dependency requirements.

### PackageVersionsLatest

This view contains the most recent snapshot in the PackageVersions table.

### Projects

This table stores information about projects. Each row represents a single project.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Type: STRING (REQUIRED)

The type of the project, example values include 'APACHE\_JIRA', 'BITBUCKET', 'GITHUB' and 'GITLAB'.

Name: STRING (REQUIRED)

The name of the project.

OpenIssuesCount: INTEGER

The number of open issues.

StarsCount: INTEGER

The number of stars in the upstream source.

ForksCount: INTEGER

The number of known forks.

Licenses: STRING (REPEATED)

A list of licenses for the project, presented as SPDX expressions.

Description: STRING

A human readable description of the project.

Homepage: STRING

A link to the homepage of the project.

OSSFuzz: RECORD

Details of this project’s testing by the OSS-Fuzz service. Only set if the project is tested by OSS-Fuzz.

OSSFuzz.LineCount: INTEGER

The number of lines of code in the project.

OSSFuzz.LineCoverCount: INTEGER

How many lines of code are covered by fuzzing.

OSSFuzz.Date: TIMESTAMP

The date the fuzz test that produced the coverage information was run against this project. The time portion of this field is midnight UTC.

OSSFuzz.ConfigURL: STRING (REQUIRED)

The URL containing the configuration for the project in the OSS-Fuzz repository.

### ProjectsLatest

This view contains the most recent snapshot in the Projects table.

### Snapshots

This table contains the timestamps for which a full snapshot of all other tables exists.

Time: TIMESTAMP (REQUIRED)

The time at which a snapshot of all other tables was taken.

### GoRequirements

This table stores the requirements for Go package versions sourced from the go.mod file for that package version.

SnapshotAt: TIMESTAMP (REQUIRED)

When this row was exported.

Name: STRING (REQUIRED)

The name of the module.

Version: STRING (REQUIRED)

The version of the package version.

DirectDependencies: RECORD (REPEATED)

The list of direct dependencies.

DirectDependencies.Name: STRING (REQUIRED)

The name of the module.

DirectDependencies.Requirement: STRING (REQUIRED)

The requirement on the module.

IndirectDependencies: RECORD (REPEATED)

The list of indirect dependencies.

IndirectDependencies.Name: STRING (REQUIRED)

The name of the module.

IndirectDependencies.Requirement: STRING (REQUIRED)

The requirement on the module.

Excludes: RECORD (REPEATED)

The list of excluded dependencies.

Excludes.Name: STRING (REQUIRED)

The name of the module.

Excludes.Requirement: STRING (REQUIRED)

The requirement on the module.

Replaces: RECORD (REPEATED)

The list of dependency replacements.

Replaces.Src: RECORD (REQUIRED)

The module to replace.

Replaces.Src.Name: STRING (REQUIRED)

The name of the module.

Replaces.Src.Requirement: STRING (NULLABLE)

The version of the module to replace (optional).

Replaces.LocalPath: STRING (NULLABLE)

Path to a local module to replace the source module with.

Replaces.Replacement: RECORD (NULLABLE)

Remote module to replace the source module with.

Replaces.Replacement.Name: STRING (REQUIRED)

The name of the module.

Replaces.Replacement.Requirement: STRING (REQUIRED)

The version of the module to replace with.

### GoRequirementsLatest

This view contains the most recent snapshot in the GoRequirements table.

## Data

deps.dev aggregates data from a number of sources:

-   Package data (including package and version names, descriptions, dependency requirements, etc)
    -   [Crates.io](https://crates.io/)
    -   [Go Module Mirror, Index, and Checksum Database](https://index.golang.org/)
    -   [Maven Central Repository](https://repo.maven.apache.org/maven2/)
    -   [Google’s Maven Repository](https://maven.google.com/)
    -   [Jenkins’ Maven Repository](https://repo.jenkins-ci.org/releases/)
    -   [Gradle Plugins Maven Repository](https://plugins.gradle.org/m2/)
    -   [npm Registry](https://registry.npmjs.org/)
    -   [NuGet](https://www.nuget.org/)
    -   [PyPI](https://pypi.org/)
    -   [RubyGems](https://rubygems.org/)
-   Project data (including project names, descriptions, forks and stars, etc)
    -   [GitHub](https://github.com/)
    -   [GitLab](https://gitlab.com/)
    -   [Bitbucket](https://bitbucket.org/)
-   Security advisories
    -   [OSV.dev](https://osv.dev/)
-   Associated data
    -   [OpenSSF Scorecard](https://github.com/ossf/scorecard)
    -   [OSS-Fuzz](https://google.github.io/oss-fuzz/)

For details on using the data from these sources, please consult their documentation.

As well as aggregating data, deps.dev generates additional data, including resolved dependencies, advisory statistics, associations between entities, etc. This generated data is available under a [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) license.

If you have questions about the dataset, or want to report a problem, please [create an issue](https://github.com/google/deps.dev/issues) or contact us at [redacted@example.invalid](mailto:redacted@example.invalid).
