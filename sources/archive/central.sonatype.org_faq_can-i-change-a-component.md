## Question[⚓︎](#question "Permanent link")

Can I change, modify, delete, remove, or update an artifact that was published to the Central Repository?

## Answer[⚓︎](#answer "Permanent link")

**No.**

Once a component has been released and published to the Central Repository, it cannot be altered. This rule is in place to preserve the stability and compatibility going forward. If you deploy an artifact, that happens to contain an error, to the Central Repository , you can _publish a new version_ of that artifact. However you will be unable to change the contents of something that has been pushed to the Central Repository already.

## Question[⚓︎](#question_1 "Permanent link")

What about bugs? I just published a bug, can I fix it?

## Answer[⚓︎](#answer_1 "Permanent link")

A new version of the component must be published.

If artifacts could be changed after publish, the Central Repository would **not** be a stable foundation to build software upon.

For example, let's say you work on a product that used Commons Math version 1.3 and some critical code relied on a particular algorithm that had a bug that you worked around. If someone came along, months after a particular release and decided to fix that binary, your own system would be affected. While the bug you worked around is fixed, your workaround would now be adding some additional error. If these calculations are critical (say for the timing of a rocket during launch, or a calculation for a vent in a reactor) you could have some serious problems.

In other words, your seemingly innocuous bug fix could introduce even larger problems. Problems you can not anticipate because you don't know of all of the potential, world-wide uses of this one particular library. In this case, even if you've identified a bug in an artifact published to the Central Repository within a few minutes, we require you to republish a new version entirely.

## Changing Release Artifacts Breaks the Model[⚓︎](#changing-release-artifacts-breaks-the-model "Permanent link")

Maven, Gradle, Ivy and other tools that work with Central have a similar pattern of interaction. All of them download artifacts from a release repository once. They don't come back to a release repository and check for a newer version. One you have the release on your local workstation, that's it. If you download version 1.3 of Commons Math and you need it again, you hit the local cache.

If release repositories were constantly changing, the tools would have to start periodically checking for a newer artifact. This would exponentially increase traffic to Central, affect everyone's builds, and break a core feature of a build tool used by millions of developers.
