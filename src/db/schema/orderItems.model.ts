import { snakeCase } from "drizzle-orm/pg-core";
import { orders } from "./orders.model";
import { products } from "./products.model";
import { productVariants } from "./productVariants.model";

export const orderItems = snakeCase.table("orderItems", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  orderId: t
    .uuid()
    .notNull()
    .references(() => orders.id, {
      onDelete: "cascade",
      name: "orderItems_orderId_fkey",
    }),

  productId: t
    .uuid()
    .notNull()
    .references(() => products.id, {
      onDelete: "set null",
      name: "orderItems_productId_fkey",
    }),

  variantId: t
    .uuid()
    .notNull()
    .references(() => productVariants.id, {
      onDelete: "set null",
      name: "orderItems_variantId_fkey",
    }),

  quantity: t.integer().notNull().default(1),

  price: t.numeric({ mode: "number" }).notNull(),

  createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
}));
