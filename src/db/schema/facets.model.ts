import {
  type AnyPgColumn,
  pgEnum,
  snakeCase,
  unique,
} from "drizzle-orm/pg-core";

export const facetTargetEnum = pgEnum("target", ["product", "variant", "both"]);

export const facets = snakeCase.table(
  "facets",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),

    key: t.text().notNull(),

    value: t.text().notNull(),

    // the facet this facet belongs to, e.g. a "size" facet whose parent is the
    // "category: clothing" facet
    parentId: t
      .uuid()
      .references((): AnyPgColumn => facets.id, { onDelete: "cascade" }),

    target: facetTargetEnum().notNull().default("both"),

    type: t.text().default("string"),

    formatting: t.text(),

    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  }),
  (t) => [unique().on(t.key, t.value)],
);
