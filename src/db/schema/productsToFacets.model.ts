import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { products } from "./products.model";
import { attributes } from "./attributes.model";

export const productsToFacets = snakeCase.table(
  "productsToFacets",
  (t) => ({
    productId: t
      .uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    facetId: t
      .uuid()
      .notNull()
      .references(() => attributes.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.productId, t.facetId] })],
);
