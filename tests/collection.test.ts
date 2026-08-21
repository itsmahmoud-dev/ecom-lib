import { afterAll, expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { NotFoundError } from "../src/utils/errors";
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
  const product1 = await makeProduct();
  const product2 = await makeProduct();

  const collection = await store.collections.addCollection({
    name,
    productIds: [product1.id, product2.id],
  });

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

  expect(result).rejects.toThrow(NotFoundError);
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

  expect(result).rejects.toThrow(NotFoundError);
});

afterAll(async () => {
  await store.db.delete(inCollection);
  await store.db.delete(collections);
  await store.db.delete(products);
});
