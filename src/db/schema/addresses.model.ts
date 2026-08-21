import { snakeCase } from "drizzle-orm/pg-core";
import { users } from "./users.model";

export const addresses = snakeCase.table("addresses", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  userId: t
    .uuid()
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
      name: "addresses_userId_fkey",
    }),

  name: t.text().notNull(),

  country: t.text().notNull(),

  state: t.text().notNull(),

  city: t.text().notNull(),

  street: t.text().notNull(),

  building: t.text().notNull(),

  floor: t.integer(),

  createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),

  updatedAt: t
    .timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));
