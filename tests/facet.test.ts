import { expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { OperError } from "../src/lib/OperError";
import { FacetErrorCodes } from "../src/lib/errors";

test("Get facets by key", async () => {
  const key = faker.string.alphanumeric(12);

  const [facet1, facet2] = await Promise.all([
    store.facets.addFacet({ key, value: faker.string.alphanumeric(8) }),
    store.facets.addFacet({ key, value: faker.string.alphanumeric(8) }),
  ]);

  const result = await store.facets.getFacetsByKey(key);

  expect(result).toHaveLength(2);
  expect(result).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: facet1!.id }),
      expect.objectContaining({ id: facet2!.id }),
    ]),
  );
});

test("Get facets by a key with no results", async () => {
  const result = await store.facets.getFacetsByKey(
    faker.string.alphanumeric(20),
  );

  expect(result).toEqual([]);
});

test("Add a facet", async () => {
  const key = faker.string.alphanumeric(12);
  const value = faker.string.alphanumeric(8);
  const type = "string";

  const facet = await store.facets.addFacet({ key, value, type });

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

  await store.facets.addFacet({ key, value, type: "string" });

  const result = store.facets.addFacet({ key, value, type: "string" });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: FacetErrorCodes.FacetAlreadyExists,
    message: expect.any(String),
  });
});

test("Remove a facet", async () => {
  const facet = await store.facets.addFacet({
    key: faker.string.alphanumeric(12),
    value: faker.string.alphanumeric(8),
    type: "string",
  });

  expect(facet).toBeDefined();

  await store.facets.removeFacet(facet!.id);

  const dbFacet = await store.db.query.facets.findFirst({
    where: {
      id: facet!.id,
    },
  });

  expect(dbFacet).toBeUndefined();
});

test("Remove a facet that does not exist", async () => {
  const result = store.facets.removeFacet(faker.string.uuid());

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: FacetErrorCodes.FacetNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});
