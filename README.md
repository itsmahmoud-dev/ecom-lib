# @itsmahmoud-dev/ecom-lib

This is a library to make scaffolding and preparing an ecommerce backend easier. It is still in alpha version so use it with caution and know that not all features have been implemented yet.

The plan is having to call methods on the store instance for common functionalities like placing an order, adding to cart/bag... instead of placing the logic directly inside the route handlers or form actions depending on the framework you use.

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

### store.users.registerUserWithEmail

| Field | Type |
|-------|------|
|name|`string`|
|email|`string`|
|password|`string`|

The user is created by default role `customer`, and status `pending`. The role only changes by admins and status changes to `active` when the account is activated. It returns `true` if the registration was successful, and throws a `U603` error if the email is already registered.
### store.users.activateUser
| Field | Type |
|-------|------|
|token|`string`|


Activates the user's account. It takes a string token to look for its user. The token should be the param given to the activate route. If it doesn't find the token, either because the token or user doesn't exist or the token has expired it will throw a `U600` error. 

### store.users.logUserIn
| Field | Type |
|-------|------|
|email|`string`|
|password|`string`|
|rememberMe|`string`|

Matches the email and verifies the password, if all is correct it returns user data and token to be sent as a cookie for auth. It throws error `U601` if email or password are wrong and `U602` if the user is not yet verified. If remembeMe is `true` then the token is valid for _30 days_ and _1 day_ if `false`. Will work on more secure refresh tokens later.

## Products

### store.products.createProduct
| Field | Type |
|-------|------|
|name|`string`|
|barcode|`string`|
|status|`ProductStatus.ACTIVE` or `ProductStatus.PENDING`|
|description|string|
|category|string|
|options|```{ attributes:Record<string, string>,  price:number, discount:number, images:File[] }[]```|

This method creates a product in the database and returns it, the options' attributes are dependant on the type of product you're creating, currently you can create clothing, and toy products. It also emits a `ProductEvent.CREATED` you can listen to with the `store.emitter` and perform an action whenever a product is created.

## Errors

#### User Errors
##### U600: Token is invalid or expired when trying to activate the user's account
- Happens when a token does not exist, for example if a user manually typed a random string that doesn't match a token in the database, or when the token has already expired.

##### U601: Invalid email or password
- Happens when the user is trying to login with email that is not registered or a wrong password. Will not make a distiction between the 2 in order not to leak unnecessary information.

##### U602: The account exists but is not yet verified
- Happens when the user is trying to login before verifying their email.

##### U603: Email is already registered
- Happens when the user is trying to create a new account with an email registered to another account.

#### Product Errors

##### P600: Duplicate barcode
- Happens when a product is being created a barcode for anothe product.
