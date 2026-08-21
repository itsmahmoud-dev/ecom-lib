import { afterAll, expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { cartItems, products, productVariants, users } from "../src/db/schema";
import { AlreadyExistsError, NotFoundError } from "../src/utils/errors";

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
    .values({ productId: product!.id, price: 19.99, quantity: 12 })
    .returning();

  return { product: product!, variant: variant! };
}

test("Add a cart item", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const item = await store.cartItems.addCartItem({
    userId: user.id,
    productId: product.id,
    variantId: variant.id,
  });

  expect(item).toBeDefined();
  expect(item).toMatchObject({
    userId: user.id,
    productId: product.id,
    variantId: variant.id,
    quantity: 1,
  });
});

test("Add a duplicate cart item for the same user, product and variant", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  await store.cartItems.addCartItem({
    userId: user.id,
    productId: product.id,
    variantId: variant.id,
  });

  const result = store.cartItems.addCartItem({
    userId: user.id,
    productId: product.id,
    variantId: variant.id,
  });

  expect(result).rejects.toThrowError(AlreadyExistsError);
});

test("Add a cart item for a user that does not exist", async () => {
  const { product, variant } = await makeVariant();

  const result = store.cartItems.addCartItem({
    userId: faker.string.uuid(),
    productId: product.id,
    variantId: variant.id,
  });

  expect(result).rejects.toThrow(NotFoundError);
});

test("Add a cart item for a variant that does not exist", async () => {
  const user = await makeUser();
  const { product } = await makeVariant();

  const result = store.cartItems.addCartItem({
    userId: user.id,
    productId: product.id,
    variantId: faker.string.uuid(),
  });

  expect(result).rejects.toThrow(NotFoundError);
});

test("Add a cart item for a product that does not exist", async () => {
  const user = await makeUser();

  const result = store.cartItems.addCartItem({
    userId: user.id,
    productId: faker.string.uuid(),
    variantId: faker.string.uuid(),
  });

  expect(result).rejects.toThrow(NotFoundError);
});

test("Remove a cart item", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product.id, variantId: variant.id })
    .returning();

  expect(item).toBeDefined();

  await store.cartItems.removeItem(item!.id);

  const removedItem = await store.db.query.cartItems.findFirst({
    where: { id: item!.id },
  });

  expect(removedItem).not.toBeDefined();
});

test("Remove a cart item that does not exist", async () => {
  const result = store.cartItems.removeItem(faker.string.uuid());

  expect(result).rejects.toThrowError(NotFoundError);
});

test("Update a cart item's quantity", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product.id, variantId: variant.id })
    .returning();

  expect(item).toBeDefined();

  const updatedItem = await store.cartItems.updateQuantity({
    id: item!.id,
    quantity: 5,
  });

  expect(updatedItem).toMatchObject({
    id: item!.id,
    quantity: 5,
  });
});

test("Update the quantity of a cart item that does not exist", async () => {
  const result = store.cartItems.updateQuantity({
    id: faker.string.uuid(),
    quantity: 5,
  });

  expect(result).rejects.toThrow(NotFoundError);
});

test("Update a cart item's quantity to a value lower than one", async () => {
  const user = await makeUser();
  const { product, variant } = await makeVariant();

  const [item] = await store.db
    .insert(cartItems)
    .values({ userId: user.id, productId: product.id, variantId: variant.id })
    .returning();

  expect(item).toBeDefined();

  const result = store.cartItems.updateQuantity({ id: item!.id, quantity: 0 });

  expect(result).rejects.toEqual(
    expect.objectContaining({
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "too_small", // or CartItemErrorsCodes.QuantityInvalid
        }),
      ]),
    }),
  );
});

test("Import cart items", async () => {
  const user = await makeUser();
  const { product: product1, variant: variant1 } = await makeVariant();
  const { product: product2, variant: variant2 } = await makeVariant();

  const items = await store.cartItems.importItems({
    userId: user.id,
    items: [
      { productId: product1.id, variantId: variant1.id, quantity: 2 },
      { productId: product2.id, variantId: variant2.id, quantity: 3 },
    ],
  });

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

  const result = store.cartItems.importItems({
    userId: user.id,
    items: [
      { productId: product2.id, variantId: variant2.id, quantity: 1 },
      { productId: product1.id, variantId: variant1.id, quantity: 1 },
    ],
  });

  expect(result).rejects.toThrow(AlreadyExistsError);
});

afterAll(async () => {
  await store.db.delete(products);
  await store.db.delete(productVariants);
  await store.db.delete(users);
});
