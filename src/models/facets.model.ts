import { pgTable, unique } from "drizzle-orm/pg-core";

export const facets = pgTable(
  "facets",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),

    key: t.text().notNull(),

    value: t.text().notNull(),

    type: t.text().notNull(),

    formatting: t.text(),

    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (t) => [unique().on(t.key, t.value)],
);
