import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { products } from "./products.model";
import { collections } from "./collections.model";

export const inCollection = snakeCase.table(
  "inCollection",
  (t) => ({
    productId: t
      .uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    collectionId: t
      .uuid()
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] })],
);
