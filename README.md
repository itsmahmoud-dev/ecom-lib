# @itsmahmoud-dev/ecom-lib

This is a library to make scaffolding and preparing an ecommerce backend easier. It is still in alpha version so use it with caution and know that not all features have been implemented yet.

The plan is having to call methods on the store instance for common functionalities like placing an order, adding to cart/library... instead of placing the logic directly inside the route handlers or form actions depending on the framework you use.

It's designed to work only in the backend so you should be able to use it with whatever framework you like, but make sure to use Bun as an envronment becuase I am using its primitives where I can instead of adding more dependencies.

Why not use something like shopify or wooComerce? Simply becuase I want to own and have control over the logic itself, not to mention also have the database on my local machine.

# Usage

## Store
You initialize the store like any other class. It takes in an object containing:
| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | The store's name |
| `dataPath` | `string` | path for file storage like product images |
| `db.PORT` | `number` | Port the database listens on (e.g. `5432`) |
| `db.NAME` | `string` | Name of the database to connect to |
| `db.USER` | `string` | Database login username |
| `db.PASS` | `string` | Database login password |
| `db.HOST` | `string` | Hostname or IP of the database server (e.g. `localhost`) |

The type's name is `StoreProps`

## Users

### store.users.registerUser
The plan is to be able to create users with an email or a phone number, but verifying using phone numbers will not work until I find an reliable SMS or RCS service. So consider it disabled till then.
| Field | Type |
|-------|------|
|type|`"email"` or `"phoneNumber"`|
|name|`string`|
|email|`string`|
|password|`string`|

The user is created by default role `customer`, and status `pending`. The role only changes by admins and status changes to `active` when the account is activated.

### store.users.activateUser
Activates the user's account. It takes a string token to look for its user. The token should be the param given to the activate route.

If it doesn't find the token, either because the token or user doesn't exist or the token has expired it will throw a `U600` error. 

## Errors
U600: Token is invalid or expired when trying to activate the user's account
- Happens when a token does not exist, for example if a user manually typed a random string that doesn't match a token in the database, or when the token has already expired.
