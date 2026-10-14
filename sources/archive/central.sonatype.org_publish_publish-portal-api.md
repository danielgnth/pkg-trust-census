## Publishing By Using the Portal Publisher API[⚓︎](#publishing-by-using-the-portal-publisher-api "Permanent link")

Intended Usage

This documentation is intended for users looking to implement clients to publish via the Portal Publisher API. If you intend to publish your own components to Maven Central, you might prefer the [Maven client](../publish-portal-maven/).

This documentation supplements the [OpenAPI documentation](https://central.sonatype.com/api-doc) which provides an interactive environment for testing queries via a web-client. For purposes of this documentation `curl` will be used in examples, but any HTTP client should be able to interact with the API by following the underlying details.

Requests to the API must be authenticated via a user token header. Given a user token of a `username` of `example_username` and a `password` of `example_password`, the token would be calculated by base64 encoding the two values joined with a `:`.

`$ printf "example_username:example_password" | base64 ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhc3N3b3Jk`

The `Authorization` header would then be in the form `Bearer <the base64 encoded value>` (i.e. `Bearer ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhc3N3b3Jk`).

UserToken Tokens

The API also accepts a non-standard `UserToken` `Authorization` header with the same base64 encoded value, but we recommend using the standard `Bearer` value and future versions of the API may drop support for `UserToken`.

## Uploading a Deployment Bundle[⚓︎](#uploading-a-deployment-bundle "Permanent link")

Assuming a [valid bundle](../publish-portal-upload/) has been created, that bundle can be uploaded to the `/api/v1/publisher/upload` endpoint via a `POST` request. The endpoint expects a `Content-Type` of `multipart/form-data` with a single part that is an `application/octet-stream` with the `name` of `bundle` and a defined filename.

The endpoint has two optional query parameters. The first, `name`, allows for providing a human-readable name for the deployment. The second, `publishingType`, can have one of the following values:

-   `AUTOMATIC`: a deployment will go through validation and, if it passes, automatically proceed to publish to Maven Central
-   `USER_MANAGED`: (default) a deployment will go through validation and require the user to manually publish it via the Portal UI

An example request to upload a bundle might look like:

`$ curl --request POST \   --verbose \   --header 'Authorization: Bearer ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhc3N3b3Jk' \   --form bundle=@central-bundle.zip \   https://central.sonatype.com/api/v1/publisher/upload`

And the response might look like:

`... * We are completely uploaded and fine < HTTP/2 201  < date: Fri, 26 Jan 2024 17:45:29 GMT < content-type: text/plain;charset=UTF-8 < content-length: 36 < vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Accept-Encoding <  * Connection #0 to host central.sonatype.com left intact 28570f16-da32-4c14-bd2e-c1acc0782365`

The value that is returned is the deployment ID, which is needed to perform operations such as retrieving information about the deployment.

### Verify Status of the Deployment[⚓︎](#verify-status-of-the-deployment "Permanent link")

Once a deployment bundle has been uploaded and the corresponding deployment ID has been retrieved, it is possible to request the status of that deployment via a `POST` request to `/api/v1/publisher/status` with a query parameter of `id` that contains the deployment ID.

An example request might look like:

`$ curl --request POST \   --verbose \   --header 'Authorization: Bearer ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhca3N3b3JkCg==' \   'https://central.sonatype.com/api/v1/publisher/status?id=28570f16-da32-4c14-bd2e-c1acc0782365' \   | jq`

And the response might look like:

`{   "deploymentId": "28570f16-da32-4c14-bd2e-c1acc0782365",   "deploymentName": "central-bundle.zip",   "deploymentState": "PUBLISHED",   "purls": [     "pkg:maven/com.sonatype.central.example/example_java_project@0.0.7"   ] }`

The `deploymentState` field can have the following values:

-   `PENDING`: A deployment is uploaded and waiting for processing by the validation service
-   `VALIDATING`: A deployment is being processed by the validation service
-   `VALIDATED`: A deployment has passed validation and is waiting on a user to manually publish via the Central Portal UI
-   `PUBLISHING`: A deployment has been either automatically or manually published and is being uploaded to Maven Central
-   `PUBLISHED`: A deployment has successfully been uploaded to Maven Central
-   `FAILED`: A deployment has encountered an error (additional context will be present in an `errors` field)

### Publish or Drop the Deployment[⚓︎](#publish-or-drop-the-deployment "Permanent link")

If a deployment was uploaded with a `publishingType` of `USER_MANAGED` and reached a `deploymentState` of `VALIDATED`, it is possible to publish the deployment via a `POST` request to `/api/v1/publisher/deployment/<deploymentId>` which will move it to the `PUBLISHING` deployment status, and from there it will make it's way to `PUBLISHED` and be available on Maven Central.

An example request might look like:

`$ curl --request POST \   --verbose \   --header 'Authorization: Bearer ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhc3N3b3Jk' \   'https://central.sonatype.com/api/v1/publisher/deployment/28570f16-da32-4c14-bd2e-c1acc0782365`

And the response might look like:

`< HTTP/2 204  < date: Tue, 30 Jan 2024 16:31:14 GMT < vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers <  * Connection #0 to host central.sonatype.com left intact`

If a deployment is in a `VALIDATED` or `FAILED` deployment state, it is possible to drop the deployment with a `DELETE` request to the `/api/v1/publisher/deployment/<deploymentId>` endpoint. This is useful to clean up the deployment history for deployments that are not intended to be published. If you are requesting support for a `FAILED` build please do not drop them as the files associated with deployments are often useful for such requests.

An example request might look like:

`$ curl --request DELETE \   --verbose \   --header 'Authorization: Bearer ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhc3N3b3Jk' \   'https://central.sonatype.com/api/v1/publisher/deployment/28570f16-da32-4c14-bd2e-c1acc0782365`

And the response might look like:

`... < HTTP/2 204  < date: Tue, 30 Jan 2024 16:31:14 GMT < vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers <  * Connection #0 to host central.sonatype.com left intact`

### Manually Testing a Deployment Bundle[⚓︎](#manually-testing-a-deployment-bundle "Permanent link")

Once a bundle has been validated it can be referenced as a dependency in your build tool of choice. The usecase for this would be building a release in a CI environment but performing manual testing in your local environment before releasing the deployment to Central.

There are two endpoints related to this feature, `/api/v1/publisher/deployment/<deploymentId>/download/<relativePath>` and `/api/v1/publisher/deployments/download/<relativePath>`. The first will reference files from a specific deployment, while the second will reference any validated deployment containing the requested file.

#### Maven[⚓︎](#maven "Permanent link")

For Maven the configuration requires adding a `<server>` and a `<repository>` to your `settings.xml` file with the required values. The `<server>` will require specifying the HTTP header to use with the request and the `<repository>` will require the URL mentioned above. An example configuration might look like:

`<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"           xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">   <servers>     <server>       <id>central.manual.testing</id>       <configuration>         <httpHeaders>           <property>             <name>Authorization</name>             <value>Bearer ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhc3N3b3Jk</value>           </property>         </httpHeaders>       </configuration>     </server>   </servers>    <profiles>     <profile>       <id>central.manual.testing</id>       <repositories>         <repository>           <id>central.manual.testing</id>           <name>Central Testing repository</name>           <url>https://central.sonatype.com/api/v1/publisher/deployments/download</url>         </repository>       </repositories>     </profile>   </profiles> </settings>`

Using this configuration requires running `mvn <command> -Pcentral.manual.testing` to request dependencies.

#### Gradle[⚓︎](#gradle "Permanent link")

For Gradle, the [documentation for declaring a repository](https://docs.gradle.org/current/userguide/declaring_repositories.html) does a good job of explaining how one might configure their build for this feature. An example configuration might look like:

`build.gradle`

`repositories {     maven {         name = "centralManualTesting"         url "https://central.sonatype.com/api/v1/publisher/deployments/download/"         credentials(HttpHeaderCredentials)         authentication {             header(HttpHeaderAuthentication)         }     }     mavenCentral() }`

`gradle.properties`

`centralManualTestingAuthHeaderName=Authorization centralManualTestingAuthHeaderValue=Bearer ZXhhbXBsZV91c2VybmFtZTpleGFtcGxlX3Bhc3N3b3Jk`
