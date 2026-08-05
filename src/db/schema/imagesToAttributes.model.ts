import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { images } from "./images.model";
import { attributes } from "./attributes.model";

export const imagesToAttributes = snakeCase.table(
  "imagesToAttributes",
  (t) => ({
    imageId: t
      .uuid()
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    attributeId: t
      .uuid()
      .notNull()
      .references(() => attributes.id, { onDelete: "cascade" }),
    key: t.text().notNull(),
  }),
  (t) => [primaryKey({ columns: [t.imageId, t.attributeId] })],
);
