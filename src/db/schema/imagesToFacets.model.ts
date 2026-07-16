import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { images } from "./images.model";
import { facets } from "./facets.model";

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
      .references(() => facets.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.imageId, t.facetId] })],
);
