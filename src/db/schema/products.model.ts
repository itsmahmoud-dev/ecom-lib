import { sql } from "drizzle-orm";
import { check, snakeCase } from "drizzle-orm/pg-core";

export const products = snakeCase.table(
  "products",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),

    name: t.text().notNull(),

    barcode: t.text().unique(),

    active: t.boolean().default(false).notNull(),

    description: t.text().notNull(),

    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),

    version: t.numeric({ mode: "number" }).notNull().default(0),

    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    check(
      "access_token_id_range",
      sql`${t.version} >= 0 AND ${t.version} < 1000`,
    ),
  ],
);
