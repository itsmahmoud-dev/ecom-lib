import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { productVariants } from "./productVariants.model";
import { attributes } from "./attributes.model";

export const productVariantsToFacets = snakeCase.table(
  "productVariantsToFacets",
  (t) => ({
    productVariantId: t
      .uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    facetId: t
      .uuid()
      .notNull()
      .references(() => attributes.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.productVariantId, t.facetId] })],
);
