import sharp from "sharp";

import {
  images,
  imagesToAttributes,
  products,
  productsToAttributes,
  productVariants,
  productVariantsToAttribute,
  productVariantsToImages,
} from "./db/schema";
import { handleError } from "./lib/errors";
import { addProductSchema } from "./types/products.type";

import type { Store } from "./Store";
import type z from "zod";

type InsertProductParams = z.infer<typeof addProductSchema>;

type UpdateProductParams = {
  p: {
    id: string;
    name?: string;
    barcode?: string | null;
    active?: boolean;
    description?: string;
    attributes?: string[];
    version: number;
  };
  v?: {
    id?: string;
    price?: number;
    discount?: number;
    quantity?: number;
    attributes?: string[];
  }[];
  i?: {
    id?: string;
    file?: File;
    attributes: string[];
  }[];
};

export class Products {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async addProduct(params: InsertProductParams) {
    try {
      const { product, variants, ...data } = addProductSchema.parse(params);

      // processing product
      const productId = crypto.randomUUID();
      const productAttributesLinks = Object.entries(product.attributes).map(
        ([key, id]) => ({
          productId: productId,
          key,
          attributeId: id,
        }),
      );

      // processing variants
      const variantsWithIds = variants.map((el) => ({
        ...el,
        id: crypto.randomUUID(),
      }));

      const variantAttributesLinks = variantsWithIds.flatMap((v) =>
        Object.entries(v.attributes).map(([key, id]) => ({
          productVariantId: v.id,
          key,
          attributeId: id,
        })),
      );

      // processing images
      const imagesWithids = await Promise.all(
        data.images.map(async (el, i) => ({
          id: crypto.randomUUID(),
          buffer: await sharp(await el.file.arrayBuffer())
            .webp({ quality: 80 })
            .toBuffer(),
          path: `/images/products/${productId}-${i}-${Date.now()}.webp`,
          file: el.file,
          attributes: el.attributes,
        })),
      );

      const imageAttributesLinks = imagesWithids.flatMap((el) =>
        Object.entries(el.attributes).map(([key, id]) => ({
          imageId: el.id,
          key,
          attributeId: id,
        })),
      );

      const variantImageLinks = imagesWithids.flatMap((image) => {
        const variantsWithSameAttributesIds = variantsWithIds.filter((v) =>
          Object.values(image.attributes).every((a) =>
            Object.values(v.attributes).includes(a),
          ),
        );

        return variantsWithSameAttributesIds.map((variant) => ({
          imageId: image.id,
          productVariantId: variant.id,
        }));
      });

      await this.store.db.transaction(async (tx) => {
        // inserting product
        await tx.insert(products).values({
          id: productId,
          name: product.name,
          barcode: product.barcode,
          active: product.active,
          description: product.description,
        });

        // inserting product attributes
        await tx.insert(productsToAttributes).values(productAttributesLinks);

        // inserting product variants
        await tx.insert(productVariants).values(
          variantsWithIds.map((el) => ({
            id: el.id,
            price: el.price,
            quantity: el.quantity,
            productId,
            discount: el.discount,
          })),
        );

        // inserting variant attributes
        await tx
          .insert(productVariantsToAttribute)
          .values(variantAttributesLinks);

        // inserting images
        await tx
          .insert(images)
          .values(imagesWithids.map((el) => ({ id: el.id, path: el.path })));

        // inserting image attributes
        await tx.insert(imagesToAttributes).values(imageAttributesLinks);

        // inserting image variant links
        await tx.insert(productVariantsToImages).values(variantImageLinks);
      });

      for (const { buffer, path } of imagesWithids) {
        await Bun.write(`${this.store.dataPath}${path}`, buffer);
      }
    } catch (e) {
      handleError(e);
    }
  }

  async updateProduct(params: UpdateProductParams) {
    try {
    } catch (e) {
      handleError(e);
    }
  }

  async deleteProduct(id: string) {}
}
