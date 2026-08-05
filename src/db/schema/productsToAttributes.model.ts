import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { products } from "./products.model";
import { attributes } from "./attributes.model";

export const productsToAttributes = snakeCase.table(
  "productsToAttributes",
  (t) => ({
    productId: t
      .uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    attributeId: t
      .uuid()
      .notNull()
      .references(() => attributes.id, { onDelete: "cascade" }),
    key: t.text().notNull(),
  }),
  (t) => [primaryKey({ columns: [t.productId, t.attributeId] })],
);
