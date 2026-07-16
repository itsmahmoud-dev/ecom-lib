import { snakeCase } from "drizzle-orm/pg-core";
import { products } from "./products.model";

export const productVariants = snakeCase.table("productVariant", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  productId: t
    .uuid()
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  price: t.numeric({ mode: "number" }).notNull(),

  discount: t.numeric({ mode: "number" }).notNull().default(0),

  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),

  updatedAt: t
    .timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));
