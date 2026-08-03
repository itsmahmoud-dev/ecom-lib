import { afterAll, expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { OperationalError } from "../src/lib/errors";
import { AttributeErrorCodes } from "../src/lib/errors";
import { attributes } from "../src/db/schema";

test("Get attributes by key", async () => {
  const key = faker.string.alphanumeric(12);

  const [attr1, attr2] = await Promise.all([
    store.attributes.addAttribute({ key, value: faker.string.alphanumeric(8) }),
    store.attributes.addAttribute({ key, value: faker.string.alphanumeric(8) }),
  ]);

  const result = await store.attributes.getAttributesByKey(key);

  expect(result).toHaveLength(2);
  expect(result).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: attr1!.id }),
      expect.objectContaining({ id: attr2!.id }),
    ]),
  );
});

test("Add an attribute", async () => {
  const key = faker.string.alphanumeric(12);
  const value = faker.string.alphanumeric(8);
  const type = "text";

  const attr = await store.attributes.addAttribute({ key, value, type });

  expect(attr).toMatchObject({
    id: expect.any(String),
    key,
    value,
    type,
    createdAt: expect.any(Date),
  });
});

test("Add an attribute with a duplicate key and value", async () => {
  const key = faker.string.alphanumeric(12);
  const value = faker.string.alphanumeric(8);

  await store.attributes.addAttribute({ key, value, type: "text" });

  const result = store.attributes.addAttribute({ key, value, type: "text" });

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: AttributeErrorCodes.AttributeAlreadyExists,
  });
});

test("Remove an attribute", async () => {
  const attr = await store.attributes.addAttribute({
    key: faker.string.alphanumeric(12),
    value: faker.string.alphanumeric(8),
    type: "text",
  });

  expect(attr).toBeDefined();

  await store.attributes.removeAttribute(attr!.id);

  const dbAttribute = await store.db.query.attributes.findFirst({
    where: {
      id: attr!.id,
    },
  });

  expect(dbAttribute).toBeUndefined();
});

test("Remove an attribute that does not exist", async () => {
  const result = store.attributes.removeAttribute(faker.string.uuid());

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: AttributeErrorCodes.AttributeNotFound,
  });
});

afterAll(async () => {
  await store.db.delete(attributes);
});
