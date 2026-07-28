import {
  type AnyPgColumn,
  pgEnum,
  snakeCase,
  unique,
} from "drizzle-orm/pg-core";

export const attributeTargetEnum = pgEnum("target", [
  "product",
  "variant",
  "both",
]);

export const attributes = snakeCase.table(
  "attributes",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),

    key: t.text().notNull(),

    value: t.text().notNull(),

    // the facet this facet belongs to, e.g. a "size" facet whose parent is the
    // "category: clothing" facet
    parentId: t
      .uuid()
      .references((): AnyPgColumn => attributes.id, { onDelete: "set null" }),

    target: attributeTargetEnum().notNull().default("both"),

    type: t
      .text({ enum: ["text", "number"] })
      .notNull()
      .default("text"),

    formatting: t.text(),

    iconName: t.text(),

    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (t) => [unique().on(t.key, t.value)],
);
