import { check, snakeCase, unique } from "drizzle-orm/pg-core";
import { users } from "./users.model";
import { products } from "./products.model";
import { productVariants } from "./productVariants.model";
import { sql } from "drizzle-orm";

export const cartItems = snakeCase.table(
  "cartItems",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),

    userId: t
      .uuid()
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        name: "cartItems_userId_fkey",
      }),

    productId: t
      .uuid()
      .notNull()
      .references(() => products.id, {
        onDelete: "cascade",
        name: "cartItems_productId_fkey",
      }),

    variantId: t
      .uuid()
      .notNull()
      .references(() => productVariants.id, {
        onDelete: "cascade",
        name: "cartItems_variantId_fkey",
      }),

    quantity: t.integer().notNull().default(1),

    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),

    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    check("min_quantity", sql`${t.quantity} >= 1`),
    unique().on(t.userId, t.productId, t.variantId),
  ],
);
