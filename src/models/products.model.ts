import { pgTable } from "drizzle-orm/pg-core";

export const products = pgTable("products", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  name: t.text().notNull(),

  barcode: t.text().unique(),

  active: t.boolean().default(false).notNull(),

  description: t.text().notNull(),

  attributes: t.jsonb().notNull().$type<Record<string, string>>(),

  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),

  updatedAt: t
    .timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));
