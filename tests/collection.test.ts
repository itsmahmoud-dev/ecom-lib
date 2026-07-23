import { afterAll, expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import {
  OperationalError,
  CollectionErrorCodes,
  ProductErrorCodes,
} from "../src/lib/errors";
import { collections, inCollection, products } from "../src/db/schema";

async function makeProduct() {
  const [product] = await store.db
    .insert(products)
    .values({
      name: faker.commerce.productName(),
      active: true,
      description: faker.commerce.productDescription(),
    })
    .returning();

  return product!;
}

test("Add a collection", async () => {
  const name = faker.commerce.department();

  const collection = await store.collections.addCollection(name);

  expect(collection).toMatchObject({ name });
});

test("Update a collection", async () => {
  const [collection] = await store.db
    .insert(collections)
    .values({ name: faker.commerce.department() })
    .returning();

  expect(collection).toBeDefined();

  const newName = faker.commerce.department();
  const updated = await store.collections.updateCollection({
    id: collection!.id,
    name: newName,
  });

  expect(updated).toMatchObject({ id: collection!.id, name: newName });
});

test("Update a collection that doesn't exist", async () => {
  const result = store.collections.updateCollection({
    id: faker.string.uuid(),
    name: faker.commerce.department(),
  });

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CollectionErrorCodes.CollectionNotFound,
  });
});

test("Add products to a collection", async () => {
  const [collection] = await store.db
    .insert(collections)
    .values({ name: faker.commerce.department() })
    .returning();

  expect(collection).toBeDefined();

  const product1 = await makeProduct();
  const product2 = await makeProduct();

  const result = await store.collections.addProductsToCollection({
    id: collection!.id,
    productIds: [product1.id, product2.id],
  });

  expect(result).toBeUndefined();

  const rows = await store.db.query.inCollection.findMany({
    where: { collectionId: collection!.id },
  });

  expect(rows).toHaveLength(2);
  expect(rows.map((r) => r.productId)).toEqual(
    expect.arrayContaining([product1.id, product2.id]),
  );
});

test("Add non-existent products to a collection", async () => {
  const [collection] = await store.db
    .insert(collections)
    .values({ name: faker.commerce.department() })
    .returning();

  expect(collection).toBeDefined();

  const result = store.collections.addProductsToCollection({
    id: collection!.id,
    productIds: [faker.string.uuid()],
  });

  expect(result).rejects.toThrow();
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.ProductNotFound,
  });
});

test("Add products to a collection that doesn't exist", async () => {
  const product = await makeProduct();

  const result = store.collections.addProductsToCollection({
    id: faker.string.uuid(),
    productIds: [product.id],
  });

  expect(result).rejects.toThrow();
  expect(result).rejects.toMatchObject({
    code: CollectionErrorCodes.CollectionNotFound,
  });
});

test("Remove products from a collection", async () => {
  const [collection] = await store.db
    .insert(collections)
    .values({ name: faker.commerce.department() })
    .returning();

  expect(collection).toBeDefined();

  const product1 = await makeProduct();
  const product2 = await makeProduct();

  await store.db.insert(inCollection).values([
    { collectionId: collection!.id, productId: product1.id },
    { collectionId: collection!.id, productId: product2.id },
  ]);

  await store.collections.removeProductsFromCollection({
    id: collection!.id,
    productIds: [product1.id, product2.id],
  });

  const rows = await store.db.query.inCollection.findMany({
    where: { collectionId: collection!.id },
  });

  expect(rows).toHaveLength(0);
});

test("Remove a collection", async () => {
  const [collection] = await store.db
    .insert(collections)
    .values({ name: faker.commerce.department() })
    .returning();

  expect(collection).toBeDefined();

  await store.collections.removeCollection(collection!.id);

  const dbCollection = await store.db.query.collections.findFirst({
    where: { id: collection!.id },
  });

  expect(dbCollection).toBeUndefined();
});

test("Remove a collection that doesn't exist", async () => {
  const result = store.collections.removeCollection(faker.string.uuid());

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: CollectionErrorCodes.CollectionNotFound,
  });
});

afterAll(async () => {
  await store.db.delete(inCollection);
  await store.db.delete(collections);
  await store.db.delete(products);
});
