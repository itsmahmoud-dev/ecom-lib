import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { images } from "./images.model";
import { attributes } from "./attributes.model";

export const imagesToFacets = snakeCase.table(
  "imagesToFacets",
  (t) => ({
    imageId: t
      .uuid()
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    facetId: t
      .uuid()
      .notNull()
      .references(() => attributes.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.imageId, t.facetId] })],
);
