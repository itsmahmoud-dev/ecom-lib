import { afterAll, expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { OperationalError } from "../src/lib/errors";
import { AttributeErrorCodes } from "../src/lib/errors";
import { attributes } from "../src/db/schema";

test("Get attributes by key", async () => {
  const key = faker.string.alphanumeric(12);

  const [facet1, facet2] = await Promise.all([
    store.attributes.addAttribute({ key, value: faker.string.alphanumeric(8) }),
    store.attributes.addAttribute({ key, value: faker.string.alphanumeric(8) }),
  ]);

  const result = await store.attributes.getAttributesByKey(key);

  expect(result).toHaveLength(2);
  expect(result).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: facet1!.id }),
      expect.objectContaining({ id: facet2!.id }),
    ]),
  );
});

test("Add a facet", async () => {
  const key = faker.string.alphanumeric(12);
  const value = faker.string.alphanumeric(8);
  const type = "text";

  const facet = await store.attributes.addAttribute({ key, value, type });

  expect(facet).toMatchObject({
    id: expect.any(String),
    key,
    value,
    type,
    createdAt: expect.any(Date),
  });
});

test("Add a facet with a duplicate key and value", async () => {
  const key = faker.string.alphanumeric(12);
  const value = faker.string.alphanumeric(8);

  await store.attributes.addAttribute({ key, value, type: "text" });

  const result = store.attributes.addAttribute({ key, value, type: "text" });

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: AttributeErrorCodes.AttributeAlreadyExists,
  });
});

test("Remove a facet", async () => {
  const facet = await store.attributes.addAttribute({
    key: faker.string.alphanumeric(12),
    value: faker.string.alphanumeric(8),
    type: "text",
  });

  expect(facet).toBeDefined();

  await store.attributes.removeAttribute(facet!.id);

  const dbAttribute = await store.db.query.attributes.findFirst({
    where: {
      id: facet!.id,
    },
  });

  expect(dbAttribute).toBeUndefined();
});

test("Remove a facet that does not exist", async () => {
  const result = store.attributes.removeAttribute(faker.string.uuid());

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: AttributeErrorCodes.AttributeNotFound,
  });
});

afterAll(async () => {
  await store.db.delete(attributes);
});
