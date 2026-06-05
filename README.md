# @itsmahmoud-dev/ecom-lib

A backend library for scaffolding e-commerce functionality. Instead of writing common logic directly inside route handlers or form actions, you call methods on a central `Store` instance. Use it with the Bun because it uses Bun primitives (like password hashing) wherever possible to avoid extra dependencies.

> **Alpha:** Not all features are implemented yet. Use with caution.

---

## Installation

```bash
bun add @itsmahmoud-dev/ecom-lib
```

Requires a PostgreSQL database.

---

## Setup

```ts
import { Store } from "@itsmahmoud-dev/ecom-lib";

const store = new Store({
  name: "My Store",
  dataPath: "/path/to/storage", // path to store data (product images, etc.)
  JWT_SECRET: "jwt secret", // for token signing
  db: {
    HOST: "localhost",
    PORT: 5432,
    NAME: "mydb",
    USER: "user",
    PASS: "password",
  },
});

await store.initializeDatabase();
```

### `new Store(props: StoreProps)`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | The store's display name |
| `dataPath` | `string` | Root path for file storage (product images are saved under `dataPath/images/products/`) |
| `JWT_SECRET` | `string` | Secret used to sign JWT tokens |
| `db.HOST` | `string` | Database host (e.g. `"localhost"`) |
| `db.PORT` | `number` | Database port (e.g. `5432`) |
| `db.NAME` | `string` | Database name |
| `db.USER` | `string` | Database username |
| `db.PASS` | `string` | Database password |

### `store.initializeDatabase()`

Connects to the PostgreSQL database and synchronizes the schema. Call this once at startup before using any other methods.

- **Returns:** `Promise<void>`

---

## Events

The store exposes an `EventEmitter` at `store.emitter`. You can listen to events to hook into product lifecycle changes.

```ts
import { ProductEvents } from "@itsmahmoud-dev/ecom-lib";

store.emitter.on(ProductEvents.CREATED, (product) => { ... });
store.emitter.on(ProductEvents.UPDATED, (product) => { ... });
store.emitter.on(ProductEvents.DELETED, (product) => { ... });
```

| Event | Value | Emitted when |
|-------|-------|--------------|
| `ProductEvents.CREATED` | `"product.created"` | A product is successfully created |
| `ProductEvents.UPDATED` | `"product.updated"` | A product is successfully updated |
| `ProductEvents.DELETED` | `"product.deleted"` | A product is successfully deleted |

The event payload is the `Product` entity.

---

## Products

### `store.products.createProduct(params)`

Creates a new product with one or more options. Each option can have multiple images — these are automatically resized to 500×500, converted to WebP, and saved to `dataPath/images/products/`.

**Parameters (`CreateProductParams`):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Product name |
| `barcode` | `string?` | Optional unique barcode |
| `status` | `ProductStatus` | `ProductStatus.ACTIVE` or `ProductStatus.PENDING` |
| `description` | `string` | Product description |
| `category` | `string` | Product category |
| `options` | `ProductOption[]` | Array of product variants (see below) |

**Option shape:**

| Field | Type | Description |
|-------|------|-------------|
| `attributes` | Product Attributes | Type-specific variant attributes (see Attributes) |
| `price` | `number` | Price in your chosen currency unit |
| `discount` | `number` | Discount amount |
| `images` | `File[]` | Images for this variant |

**Returns:** `Promise<Product>` — the saved product entity with all options.

**Throws:** `OperError` with code `P600` if the barcode already exists.

**Emits:** `ProductEvents.CREATED`

---

### `store.products.updateProduct(params)`

Updates an existing product's fields and/or options. Handles image deletion and renaming when options are marked dirty.

**Parameters (`UpdateProductParams`):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | ID of the product to update |
| `name` | `string?` | New product name |
| `barcode` | `string \| null \| undefined` | New barcode (must be unique across other products) |
| `status` | `ProductStatus?` | New status |
| `description` | `string?` | New description |
| `category` | `string?` | New category |
| `options` | `UpdateOptionParams[]?` | Options to update (see below) |
| `imagesToDelete` | `string[]?` | Filenames of images to delete from disk |

**Update option shape:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | ID of the option to update |
| `dirty` | `boolean?` | If `true`, existing images without a new `file` are renamed to reflect attribute changes |
| `attributes` | `ProductAttributes` | Updated attributes |
| `price` | `number` | Updated price |
| `discount` | `number` | Updated discount |
| `imagesData` | `{ file?: File; fileName?: string }[]` | Each entry is either a new `File` upload or an existing `fileName` to keep/rename |

**Returns:** `Promise<Product>` — the updated product entity.

**Throws:**
- `OperError` with code `P600` if the new barcode belongs to a different product.
- `OperError` with code `P601` if no product with the given `id` exists.

**Emits:** `ProductEvents.UPDATED`

---

### `store.products.deleteProduct(id)`

Deletes a product and all of its associated options (cascade).

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `number` | ID of the product to delete |

**Returns:** `Promise<void>`

**Throws:** `OperError` with code `P601` if no product with the given `id` exists.

**Emits:** `ProductEvents.DELETED`

---

## Users

### `store.users.registerUserWithEmail(name, email, password)`

Creates a new user account. The password is hashed with Argon2id via Bun's built-in hasher. A 10-minute activation token is generated and attached to the user. It should send an email to the user with the activation link, **but yet implemented.**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | User's display name |
| `email` | `string` | User's email address (must be unique) |
| `password` | `string` | Plain-text password (hashed before storage) |

**Returns:** `Promise<true>` on success.

**Throws:** `OperError` with code `U603` if the email is already registered.

**Default user state on creation:**
- `role`: `customer`
- `status`: `pending` (account must be activated before login)

---

### `store.users.activateUser(token)`

Activates a user account using the token sent to their email. The token expires 10 minutes after registration.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `string` | The activation token from the URL param |

**Returns:** `Promise<true>` on success.

**Throws:** `OperError` with code `U600` if the token does not exist or has expired.

**Side effects:** Clears `activationToken` and `activationTokenExpiry`, sets `status` to `active`.

---

### `store.users.logUserIn(email, password, rememberMe?)`

Authenticates a user and returns a signed JWT token.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `email` | `string` | — | User's email |
| `password` | `string` | — | Plain-text password to verify |
| `rememberMe` | `boolean` | `false` | If `true`, token expires in 30 days; otherwise 1 day |

**Returns:**
```ts
Promise<{
  token: string;       // JWT signed with HS512
  user: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
  };
}>
```

**Throws:**
- `OperError` with code `U601` if the email is not found or the password is wrong.
- `OperError` with code `U602` if the account has not been activated yet.

---

## Product Attributes

Attributes are typed per product category. The `type` field is the discriminator.

### Clothing (`type: "clothing"`)

| Field | Type |
|-------|------|
| `type` | `"clothing"` |
| `size` | `string` |
| `color` | `string` |

### Toy (`type: "toy"`)

| Field | Type |
|-------|------|
| `type` | `"toy"` |
| `ageRange` | `string` |
| `color` | `string` |

---

## Enums

### `ProductStatus`
| Value | String |
|-------|--------|
| `ProductStatus.ACTIVE` | `"active"` |
| `ProductStatus.PENDING` | `"pending"` |

### `UserRole`
| Value | String |
|-------|--------|
| `UserRole.ADMIN` | `"admin"` |
| `UserRole.MEMBER` | `"member"` |
| `UserRole.CUSTOMER` | `"customer"` |

### `UserStatus`
| Value | String |
|-------|--------|
| `UserStatus.ACTIVE` | `"active"` |
| `UserStatus.PENDING` | `"pending"` |

---

## Error Handling

All errors are instances of `OperError` which extends `Error`.

```ts
import { OperError } from "@itsmahmoud-dev/ecom-lib";

try {
  await store.users.logUserIn(email, password);
} catch (err) {
  if (err instanceof OperError) {
    console.log(err.code);    // e.g. "U601"
    console.log(err.message); // human readable message
    console.log(err.cause)    // underlying cause of the error (if available)
    console.log(err.key);     // field name that caused the error (if available)
    console.log(err.value);   // offending value (if available)
  }
}
```

### User Errors

| Code | Name | When it's thrown |
|------|------|------------------|
| `U600` | `TokenInvalidOrExpired` | Activation token does not exist or has expired (past 10 minutes) |
| `U601` | `InvalidEmailOrPassword` | Email not found or password is wrong. No distinction is made to avoid leaking info |
| `U602` | `AccountNotVerified` | Login attempted before the account is activated |
| `U603` | `EmailAlreadyRegistered` | Registration attempted with an email already in use |

### Product Errors

| Code | Name | When it's thrown |
|------|------|------------------|
| `P600` | `BarcodeAlreadyExists` | Creating or updating a product with a barcode already used by another product |
| `P601` | `ProductNotFound` | Updating or deleting a product whose ID does not exist |
