import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { productVariants } from "./productVariants.model";
import { facets } from "./facets.model";

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
      .references(() => facets.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.productVariantId, t.facetId] })],
);
