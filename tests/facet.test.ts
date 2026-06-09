import { test, expect } from "bun:test";

import { store } from ".";
import { FacetDefination } from "../src/db";
import { OperError } from "../src/lib/OperError";
import { FacetErrorCodes } from "../src/types/error";

test("Add a facet", async () => {
  const facet = await store.facets.addFacet("category", "Electronics");

  expect(facet).toBeInstanceOf(FacetDefination);
  expect(facet).toMatchObject({ key: "category", value: "Electronics" });
});

test("Add a facet with duplicate key and value", async () => {
  const facet = store.facets.addFacet("category", "Electronics");

  expect(facet).rejects.toThrow(OperError);
  expect(facet).rejects.toMatchObject({
    code: FacetErrorCodes.FacetAlreadyExists,
  });
});
