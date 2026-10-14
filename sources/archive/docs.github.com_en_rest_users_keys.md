Use the REST API to manage Git SSH keys of authenticated users.

## [About Git SSH key administration](#about-git-ssh-key-administration)

If a request URL does not include a `{username}` parameter then the response will be for the signed-in user (and you must pass [authentication information](/en/rest/authentication/authenticating-to-the-rest-api) with your request). Additional private information, such as whether a user has two-factor authentication enabled, is included when authenticated through OAuth with the `user` scope.

## [List public SSH keys for the authenticated user](#list-public-ssh-keys-for-the-authenticated-user)

Lists the public SSH keys for the authenticated user's GitHub account.

OAuth app tokens and personal access tokens (classic) need the `read:public_key` scope to use this endpoint.

### [Fine-grained access tokens for "List public SSH keys for the authenticated user"](#list-public-ssh-keys-for-the-authenticated-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

-   [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
-   [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token must have the following permission set:

-   "Git SSH keys" user permissions (read)

### [Parameters for "List public SSH keys for the authenticated user"](#list-public-ssh-keys-for-the-authenticated-user--parameters)

Headers

Name, Type, Description

`accept` string

Setting to `application/vnd.github+json` is recommended.

Query parameters

Name, Type, Description

`per_page` integer

The number of results per page (max 100). For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `30`

`page` integer

The page number of the results to fetch. For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `1`

### [HTTP response status codes for "List public SSH keys for the authenticated user"](#list-public-ssh-keys-for-the-authenticated-user--status-codes)

Status code

Description

`200`

OK

`304`

Not modified

`401`

Requires authentication

`403`

Forbidden

`404`

Resource not found

### [Code samples for "List public SSH keys for the authenticated user"](#list-public-ssh-keys-for-the-authenticated-user--code-samples)

#### Request example

get/user/keys

`curl -L \ -H "Accept: application/vnd.github+json" \ -H "Authorization: Bearer <YOUR-TOKEN>" \ -H "X-GitHub-Api-Version: 2026-03-10" \ https://api.github.com/user/keys`

#### 

Response

`Status: 200`

`[ { "key": "2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvv1234", "id": 2, "url": "https://api.github.com/user/keys/2", "title": "ssh-rsa AAAAB3NzaC1yc2EAAA", "created_at": "2020-06-11T21:31:57Z", "verified": false, "read_only": false }, { "key": "2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJy931234", "id": 3, "url": "https://api.github.com/user/keys/3", "title": "ssh-rsa AAAAB3NzaC1yc2EAAB", "created_at": "2020-07-11T21:31:57Z", "verified": false, "read_only": false } ]`

## [Create a public SSH key for the authenticated user](#create-a-public-ssh-key-for-the-authenticated-user)

Adds a public SSH key to the authenticated user's GitHub account.

OAuth app tokens and personal access tokens (classic) need the `write:public_key` scope to use this endpoint.

### [Fine-grained access tokens for "Create a public SSH key for the authenticated user"](#create-a-public-ssh-key-for-the-authenticated-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

-   [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
-   [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token must have the following permission set:

-   "Git SSH keys" user permissions (write)

### [Parameters for "Create a public SSH key for the authenticated user"](#create-a-public-ssh-key-for-the-authenticated-user--parameters)

Headers

Name, Type, Description

`accept` string

Setting to `application/vnd.github+json` is recommended.

Body parameters

Name, Type, Description

`title` string

A descriptive name for the new key.

`key` string Required

The public SSH key to add to your GitHub account.

### [HTTP response status codes for "Create a public SSH key for the authenticated user"](#create-a-public-ssh-key-for-the-authenticated-user--status-codes)

Status code

Description

`201`

Created

`304`

Not modified

`401`

Requires authentication

`403`

Forbidden

`404`

Resource not found

`422`

Validation failed, or the endpoint has been spammed.

### [Code samples for "Create a public SSH key for the authenticated user"](#create-a-public-ssh-key-for-the-authenticated-user--code-samples)

#### Request example

post/user/keys

`curl -L \ -X POST \ -H "Accept: application/vnd.github+json" \ -H "Authorization: Bearer <YOUR-TOKEN>" \ -H "X-GitHub-Api-Version: 2026-03-10" \ https://api.github.com/user/keys \ -d '{"title":"ssh-rsa AAAAB3NzaC1yc2EAAA","key":"2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvv1234"}'`

#### 

Response

`Status: 201`

`{ "key": "2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvv1234", "id": 2, "url": "https://api.github.com/user/keys/2", "title": "ssh-rsa AAAAB3NzaC1yc2EAAA", "created_at": "2020-06-11T21:31:57Z", "verified": false, "read_only": false }`

## [Get a public SSH key for the authenticated user](#get-a-public-ssh-key-for-the-authenticated-user)

View extended details for a single public SSH key.

OAuth app tokens and personal access tokens (classic) need the `read:public_key` scope to use this endpoint.

### [Fine-grained access tokens for "Get a public SSH key for the authenticated user"](#get-a-public-ssh-key-for-the-authenticated-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

-   [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
-   [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token must have the following permission set:

-   "Git SSH keys" user permissions (read)

### [Parameters for "Get a public SSH key for the authenticated user"](#get-a-public-ssh-key-for-the-authenticated-user--parameters)

Headers

Name, Type, Description

`accept` string

Setting to `application/vnd.github+json` is recommended.

Path parameters

Name, Type, Description

`key_id` integer Required

The unique identifier of the key.

### [HTTP response status codes for "Get a public SSH key for the authenticated user"](#get-a-public-ssh-key-for-the-authenticated-user--status-codes)

Status code

Description

`200`

OK

`304`

Not modified

`401`

Requires authentication

`403`

Forbidden

`404`

Resource not found

### [Code samples for "Get a public SSH key for the authenticated user"](#get-a-public-ssh-key-for-the-authenticated-user--code-samples)

#### Request example

get/user/keys/{key\_id}

`curl -L \ -H "Accept: application/vnd.github+json" \ -H "Authorization: Bearer <YOUR-TOKEN>" \ -H "X-GitHub-Api-Version: 2026-03-10" \ https://api.github.com/user/keys/KEY_ID`

#### 

Response

`Status: 200`

`{ "key": "2Sg8iYjAxxmI2LvUXpJjkYrMxURPc8r+dB7TJyvv1234", "id": 2, "url": "https://api.github.com/user/keys/2", "title": "ssh-rsa AAAAB3NzaC1yc2EAAA", "created_at": "2020-06-11T21:31:57Z", "verified": false, "read_only": false }`

## [Delete a public SSH key for the authenticated user](#delete-a-public-ssh-key-for-the-authenticated-user)

Removes a public SSH key from the authenticated user's GitHub account.

OAuth app tokens and personal access tokens (classic) need the `admin:public_key` scope to use this endpoint.

### [Fine-grained access tokens for "Delete a public SSH key for the authenticated user"](#delete-a-public-ssh-key-for-the-authenticated-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

-   [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
-   [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token must have the following permission set:

-   "Git SSH keys" user permissions (write)

### [Parameters for "Delete a public SSH key for the authenticated user"](#delete-a-public-ssh-key-for-the-authenticated-user--parameters)

Headers

Name, Type, Description

`accept` string

Setting to `application/vnd.github+json` is recommended.

Path parameters

Name, Type, Description

`key_id` integer Required

The unique identifier of the key.

### [HTTP response status codes for "Delete a public SSH key for the authenticated user"](#delete-a-public-ssh-key-for-the-authenticated-user--status-codes)

Status code

Description

`204`

No Content

`304`

Not modified

`401`

Requires authentication

`403`

Forbidden

`404`

Resource not found

### [Code samples for "Delete a public SSH key for the authenticated user"](#delete-a-public-ssh-key-for-the-authenticated-user--code-samples)

#### Request example

delete/user/keys/{key\_id}

`curl -L \ -X DELETE \ -H "Accept: application/vnd.github+json" \ -H "Authorization: Bearer <YOUR-TOKEN>" \ -H "X-GitHub-Api-Version: 2026-03-10" \ https://api.github.com/user/keys/KEY_ID`

#### 

Response

`Status: 204`

## [List public keys for a user](#list-public-keys-for-a-user)

Lists the _verified_ public SSH keys for a user. This is accessible by anyone.

### [Fine-grained access tokens for "List public keys for a user"](#list-public-keys-for-a-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

-   [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
-   [GitHub App installation access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
-   [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token must have the following permission set:

-   "Git SSH keys" user permissions (read)

This endpoint can be used without authentication or the aforementioned permissions if only public resources are requested.

### [Parameters for "List public keys for a user"](#list-public-keys-for-a-user--parameters)

Headers

Name, Type, Description

`accept` string

Setting to `application/vnd.github+json` is recommended.

Path parameters

Name, Type, Description

`username` string Required

The handle for the GitHub user account.

Query parameters

Name, Type, Description

`per_page` integer

The number of results per page (max 100). For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `30`

`page` integer

The page number of the results to fetch. For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `1`

### [HTTP response status codes for "List public keys for a user"](#list-public-keys-for-a-user--status-codes)

Status code

Description

`200`

OK

### [Code samples for "List public keys for a user"](#list-public-keys-for-a-user--code-samples)

#### Request example

get/users/{username}/keys

`curl -L \ -H "Accept: application/vnd.github+json" \ -H "X-GitHub-Api-Version: 2026-03-10" \ https://api.github.com/users/USERNAME/keys`

#### 

Response

`Status: 200`

`[ { "id": 1, "key": "ssh-rsa AAA..." } ]`
