import { primaryKey, snakeCase } from "drizzle-orm/pg-core";
import { productVariants } from "./productVariants.model";
import { images } from "./images.model";

export const productVariantsToImages = snakeCase.table(
  "productVariantsToImages",
  (t) => ({
    productVariantId: t
      .uuid()
      .notNull()
      .references(() => productVariants.id, {
        onDelete: "cascade",
        name: "productVariantsToImages_productVariantId_fkey",
      }),
    imageId: t
      .uuid()
      .notNull()
      .references(() => images.id, {
        onDelete: "cascade",
        name: "productVariantsToImages_imageId_fkey",
      }),
  }),
  (t) => [primaryKey({ columns: [t.productVariantId, t.imageId] })],
);
