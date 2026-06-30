import sharp from "sharp";

import { products, productVariants } from "./models";
import { handleError } from "./lib/errors";

import type { Store } from "./Store";

export class Products {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async createProduct(
    p: typeof products.$inferInsert & {
      variants: (Omit<
        typeof productVariants.$inferInsert,
        "images" | "productId"
      > & {
        images: File[];
      })[];
    },
  ) {
    await this.store.db.transaction(async (tx) => {
      console.log(p.name);
      try {
        const [product] = await tx
          .insert(products)
          .values({
            name: p.name,
            barcode: p.barcode,
            description: p.description,
            attributes: p.attributes,
            active: p.active,
          })
          .returning();

        if (!product) {
          throw new Error("Something went wrong while inserting a product");
        }

        const nameSlug = p.name
          .split(" ")
          .map((el) => el.toLowerCase())
          .join("-");

        const variantRows = await Promise.all(
          p.variants.map(async (v) => {
            const attrsSlug = Object.values(v.attributes)
              .map((v) => v.toLowerCase().replaceAll(" ", "-").replace("/", "-"))
              .join("-");

            const filenames = await Promise.all(
              v.images.map(async (img, i) => {
                const filename = `${nameSlug}-${attrsSlug}-${Date.now()}-${i + 1}`;

                await sharp(await img.arrayBuffer())
                  .resize({ width: 500, height: 500, fit: "cover" })
                  .toFormat("webp")
                  .toFile(
                    `${this.store.dataPath}/images/products/${filename}.webp`,
                  );

                return filename;
              }),
            );

            return {
              productId: product.id,
              attributes: v.attributes,
              price: v.price,
              discount: v.discount,
              images: filenames,
            };
          }),
        );

        if (variantRows.length > 0) {
          await tx.insert(productVariants).values(variantRows);
        }
      } catch (e) {
        handleError(e);
      }
    });
  }

  async updateProduct(params: any) {}

  async deleteProduct(id: number) {}
}
