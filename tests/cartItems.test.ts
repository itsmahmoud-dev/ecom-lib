import { expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { cartItems, products, productVariants, users } from "../src/db/schema";
import { CartItemErrorsCodes, OperationalError } from "../src/lib/errors";

async function makeUser() {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
      status: "verified",
    })
    .returning();

  return user!;
}

async function makeVariant() {
  const [product] = await store.db
    .insert(products)
    .values({
      name: faker.commerce.productName(),
      active: true,
      description: faker.commerce.productDescription(),
    })
    .returning();

  const [variant] = await store.db
    .insert(productVariants)
    .values({ productId: product!.id, price: 19.99 })
    .returning();

  return { product: product!, variant: variant! };
}

test("Add a cart item", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const item = await store.cartItems.addCartItem(
    user.id,
    product.id,
    variant.id,
  );

  expect(item).toBeDefined();
  expect(item![0]).toMatchObject({
    userId: user.id,
    productId: product.id,
    variantId: variant.id,
    quantity: 1,
  });
});

test("Add a duplicate cart item for the same user, product and variant", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  await store.cartItems.addCartItem(user.id, product.id, variant.id);

  const result = store.cartItems.addCartItem(user.id, product.id, variant.id);

  expect(result).rejects.toThrowError(OperationalError);

  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.CartItemAlreadyExists,
  });
});

test("Remove a cart item", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product.id, variantId: variant.id })
    .returning();

  expect(item).toBeDefined();

  const removedId = await store.cartItems.removeItem(item!.id);

  expect(removedId).toBe(item!.id);

  const dbItem = await store.db.query.cartItems.findFirst({
    where: { id: item!.id },
  });

  expect(dbItem).toBeUndefined();
});

test("Remove a cart item that does not exist", async () => {
  const result = store.cartItems.removeItem(faker.string.uuid());

  expect(result).rejects.toThrowError(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.CartItemNotFound,
  });
});

test("Increment a cart item's quantity", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product.id, variantId: variant.id })
    .returning();

  expect(item).toBeDefined();

  const updatedItem = await store.cartItems.incrementQuantity(item!.id);

  expect(updatedItem).toMatchObject({
    id: item!.id,
    quantity: item!.quantity + 1,
  });
});

test("Increment the quantity of a cart item that does not exist", async () => {
  const result = store.cartItems.incrementQuantity(faker.string.uuid());

  expect(result).rejects.toThrowError(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.CartItemNotFound,
  });
});

test("Decrement a cart item's quantity", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({
      userId: user.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 2,
    })
    .returning();

  expect(item).toBeDefined();

  const updatedItem = await store.cartItems.decrementQuantity(item!.id);

  expect(updatedItem).toMatchObject({
    id: item!.id,
    quantity: item!.quantity - 1,
  });
});

test("Decrement the quantity of a cart item that does not exist", async () => {
  const result = store.cartItems.decrementQuantity(faker.string.uuid());

  expect(result).rejects.toThrowError(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.CartItemNotFound,
  });
});

test("Decrement the quantity of a cart item with a quantity of one", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({
      userId: user.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
    })
    .returning();

  expect(item).toBeDefined();

  const result = store.cartItems.decrementQuantity(item!.id);

  expect(result).rejects.toThrow(OperationalError);

  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.QuantityInvalid,
  });
});

test("Update a cart item's quantity", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product.id, variantId: variant.id })
    .returning();

  expect(item).toBeDefined();

  const updatedItem = await store.cartItems.updateQuantity(item!.id, 5);

  expect(updatedItem).toMatchObject({
    id: item!.id,
    quantity: 5,
  });
});

test("Update the quantity of a cart item that does not exist", async () => {
  const result = store.cartItems.updateQuantity(faker.string.uuid(), 5);

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.CartItemNotFound,
  });
});

test("Update a cart item's quantity to a value lower than one", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product.id, variantId: variant.id })
    .returning();

  expect(item).toBeDefined();

  const result = store.cartItems.updateQuantity(item!.id, 0);

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.QuantityInvalid,
  });
});

test("Import cart items", async () => {
  const user = await makeUser();
  const { product: product1, variant: variant1 } = await makeVariant();
  const { product: product2, variant: variant2 } = await makeVariant();

  const items = await store.cartItems.importItems(user.id, [
    { productId: product1.id, variantId: variant1.id, quantity: 2 },
    { productId: product2.id, variantId: variant2.id, quantity: 3 },
  ]);

  expect(items).toHaveLength(2);
  expect(items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        userId: user.id,
        productId: product1.id,
        variantId: variant1.id,
        quantity: 2,
      }),
      expect.objectContaining({
        userId: user.id,
        productId: product2.id,
        variantId: variant2.id,
        quantity: 3,
      }),
    ]),
  );
});

test("Import cart items with at least one duplicate", async () => {
  const user = await makeUser();
  const { product: product1, variant: variant1 } = await makeVariant();
  const { product: product2, variant: variant2 } = await makeVariant();

  await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product1.id, variantId: variant1.id });

  const result = store.cartItems.importItems(user.id, [
    { productId: product2.id, variantId: variant2.id, quantity: 1 },
    { productId: product1.id, variantId: variant1.id, quantity: 1 },
  ]);

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CartItemErrorsCodes.CartItemAlreadyExists,
  });
});
