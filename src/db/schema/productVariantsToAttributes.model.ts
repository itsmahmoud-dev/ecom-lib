import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { productVariants } from "./productVariants.model";
import { attributes } from "./attributes.model";

export const productVariantsToAttributes = snakeCase.table(
  "productVariantsToAttributes",
  (t) => ({
    productVariantId: t
      .uuid()
      .notNull()
      .references(() => productVariants.id, {
        onDelete: "cascade",
        name: "productVariantsToAttributes_productVariantId_fkey",
      }),
    attributeId: t
      .uuid()
      .notNull()
      .references(() => attributes.id, {
        onDelete: "cascade",
        name: "productVariantsToAttributes_attributeId_fkey",
      }),
    key: t.text().notNull(),
  }),
  (t) => [primaryKey({ columns: [t.productVariantId, t.attributeId] })],
);
