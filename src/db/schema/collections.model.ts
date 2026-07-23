import { snakeCase } from "drizzle-orm/pg-core";

export const collections = snakeCase.table("collections", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  name: t.text().notNull(),

  createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),

  updatedAt: t
    .timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));
