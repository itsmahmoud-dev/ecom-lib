import { pgTable } from "drizzle-orm/pg-core";
import { products } from "./products.model";

export const productVariants = pgTable("productVariant", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  productId: t
    .uuid()
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  attributes: t.jsonb().notNull().$type<Record<string, string>>(),

  price: t.numeric({ mode: "number" }).notNull(),

  discount: t.numeric({ mode: "number" }).notNull().default(0),

  images: t.text().array().notNull().default([]),

  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),

  updatedAt: t
    .timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));
