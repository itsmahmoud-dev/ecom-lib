import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { productVariants } from "./productVariants.model";
import { images } from "./images.model";

export const productVariantsToImages = snakeCase.table(
  "productVariantsToImages",
  (t) => ({
    productVariantId: t
      .uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    imageId: t
      .uuid()
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.productVariantId, t.imageId] })],
);
