#### Details

-   **Type: **![](/jira/secure/viewavatar?size=xsmall&avatarId=21140&avatarType=issuetype "Improvement - An improvement or enhancement to an existing feature or task.") Improvement
    
-   **Status:** Closed
    
-   **Priority: **![](/jira/images/icons/priorities/minor.svg "Minor - Minor loss of function, or other problem where easy workaround is present.") Minor
    
-   **Resolution:** Fixed
    
-   **Affects Version/s:** 3.6.3
    
-   **Fix Version/s:** [4.0.0-alpha-2](/jira/issues/?jql=project+%3D+MNG+AND+fixVersion+%3D+4.0.0-alpha-2 "4.0.0-alpha-2 1st alpha of Maven4"), [4.0.0](/jira/issues/?jql=project+%3D+MNG+AND+fixVersion+%3D+4.0.0 "4.0.0 Maven 4.0.0 GA")
    
-   **Component/s:** [Artifacts and Repositories](/jira/issues/?jql=project+%3D+MNG+AND+component+%3D+%22Artifacts+and+Repositories%22 "Artifacts and Repositories ")
    
-   **Labels:**
    
    None
    

#### Description

The default checksum policy when obtaining artifacts during a build is currently, by default, "warn". This seems a bit odd for me since a checksum is usually used to prevent the use of corrupted data.

Since Maven produces a lot of output (and some IDEs sometimes hide it), it is easy to miss a bad checksum warning. I am aware that there is a checksumPolicy setting in Maven, but, unless I am mistaken, it cannot be defined for all repositories at once. It has to be done either on a per-repository basis or by using the "strict-checksum" flag in the command line.

After searching around a bit on the Web and with the help of a coworker, we discovered that the default "warn" setting was mainly there because some repositories were not handling checksums quite well. Issue [MNG-339](https://issues.apache.org/jira/browse/MNG-339 "improve checksum handling") contains some information about this.

My colleague also chatted briefly with "trygvis" on IRC. Apparently, the default "warn" setting is really there for historical reasons.

I believe that a default value of "fail" would greatly reduce the likelihood of errors and also slightly increase the security of Maven. Corrupted artifacts should not, by default, be used for builds.

#### Attachments

#### Issue Links

is duplicated by

![Bug - A problem which impairs or prevents the functions of the product.](/jira/secure/viewavatar?size=xsmall&avatarId=21133&avatarType=issuetype "Bug - A problem which impairs or prevents the functions of the product.") [MNG-6422](/jira/browse/MNG-6422) Maven by default does not check checksums; Maven lacks reproducible builds capability

-   ![Major - Major loss of function.](/jira/images/icons/priorities/major.svg "Major - Major loss of function.")
-   Closed

relates to

![Improvement - An improvement or enhancement to an existing feature or task.](/jira/secure/viewavatar?size=xsmall&avatarId=21140&avatarType=issuetype "Improvement - An improvement or enhancement to an existing feature or task.") [MNG-5689](/jira/browse/MNG-5689) Checksum policy for mirrors

-   ![Major - Major loss of function.](/jira/images/icons/priorities/major.svg "Major - Major loss of function.")
-   Reopened

![Task - A task that needs to be done.](/jira/secure/viewavatar?size=xsmall&avatarId=21148&avatarType=issuetype "Task - A task that needs to be done.") [MRESOLVER-151](/jira/browse/MRESOLVER-151) Enforce a checksum policy to be provided explicitly

-   ![Major - Major loss of function.](/jira/images/icons/priorities/major.svg "Major - Major loss of function.")
-   Closed

links to

![Web Link](https://github.com/favicon.ico "Web Link") [GitHub Pull Request #36](https://github.com/apache/maven/pull/36)

![Web Link](https://github.com/favicon.ico "Web Link") [GitHub Pull Request #84](https://github.com/apache/maven-integration-testing/pull/84)

![Web Link](https://github.com/favicon.ico "Web Link") [GitHub Pull Request #405](https://github.com/apache/maven/pull/405)

![Web Link](https://github.com/favicon.ico "Web Link") [GitHub Pull Request #407](https://github.com/apache/maven/pull/407)

Show 2 more links (2 links to)

#### Activity

#### People

Assignee:

 ![rfscholte](https://issues.apache.org/jira/secure/useravatar?size=small&avatarId=10452) Robert Scholte

Reporter:

 ![sfl-njuneau](https://issues.apache.org/jira/secure/useravatar?size=small&avatarId=10452) Nicolas Juneau

Votes:

10 Vote for this issue

Watchers:

14 Start watching this issue

#### Dates

Created:

27/Nov/14 15:54

Updated:

06/Jul/25 07:25

Resolved:

02/Dec/20 19:54
