import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { productVariants } from "./productVariants.model";
import { attributes } from "./attributes.model";

export const productVariantsToAttribute = snakeCase.table(
  "productVariantsToAttributes",
  (t) => ({
    productVariantId: t
      .uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    attributeId: t
      .uuid()
      .notNull()
      .references(() => attributes.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.productVariantId, t.attributeId] })],
);
