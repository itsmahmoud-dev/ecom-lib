import sharp from "sharp";

import {
  images,
  imagesToAttributes,
  products,
  productsToAttributes,
  productVariants,
  productVariantsToAttributes,
  productVariantsToImages,
} from "./db/schema";
import { handleError, OperationalError, ProductErrorCodes } from "./lib/errors";
import {
  addProductSchema,
  deleteProductParamSchema,
  updateProductSchema,
} from "./types/products.type";

import type { Store } from "./Store";
import type z from "zod";
import { and, eq, inArray, or, SQL, sql } from "drizzle-orm";

type InsertProductParams = z.infer<typeof addProductSchema>;

type UpdateProductParams = z.infer<typeof updateProductSchema>;

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
          path: `/images/products/${productId}-${Date.now()}${i}.webp`,
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
          .insert(productVariantsToAttributes)
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

      return productId;
    } catch (e) {
      handleError(e);
    }
  }

  async updateProduct(params: UpdateProductParams) {
    try {
      const { product, variants, ...data } = updateProductSchema.parse(params);

      const dbProduct = await this.store.db.query.products.findFirst({
        where: { id: product.id },
        with: {
          attributes: {
            columns: { id: true, key: true },
          },
          variants: {
            with: {
              attributes: {
                columns: { id: true, key: true },
              },
              images: {
                with: {
                  attributes: { columns: { id: true, key: true } },
                },
              },
            },
          },
        },
      });

      if (!dbProduct) {
        throw new OperationalError({
          code: ProductErrorCodes.ProductNotFound,
          message: "Updating a product failed because it does not exist",
        });
      }

      if (dbProduct.version !== product.version) {
        throw new OperationalError({
          code: ProductErrorCodes.VersionMismatch,
          message: "Updating a product failed because the versions mismatched",
        });
      }

      const imageFilesToDelete = dbProduct.variants
        .flatMap((el) => el.images)
        .filter((el) => data.imagesToDelete?.includes(el.id))
        .map((el) => el.path);

      // =================== product's attributes ===================
      const updateProductAttrSQLChunks: SQL[] = [];

      if (product.attributes && Object.keys(product.attributes).length > 0) {
        for (const [key, id] of Object.entries(product.attributes)) {
          updateProductAttrSQLChunks.push(
            sql`WHEN ${productsToAttributes.productId} = ${product.id} AND ${productsToAttributes.key} = ${key} THEN ${id}`,
          );
        }
      }

      // =================== variants ===================
      const newVariantsWithIds = variants
        ?.filter((el) => el.id === undefined)
        ?.map((variant) => ({
          ...variant,
          id: crypto.randomUUID(),
        }));

      const newVariantsToInsert = newVariantsWithIds?.map((variant) => ({
        id: variant.id,
        productId: product.id,
        price: variant.price,
        discount: variant.discount,
        quantity: variant.quantity,
      }));

      const newVariantsAttrToInsert = newVariantsWithIds?.flatMap((variant) =>
        Object.entries(variant.attributes).map(([key, id]) => ({
          productVariantId: variant.id,
          key,
          attributeId: id,
        })),
      );

      const updateVariantPayload: Record<string, SQL> = {};

      const priceCases: SQL[] = [];
      const discountCases: SQL[] = [];
      const quantityCases: SQL[] = [];
      const affectedIds = new Set<string>();

      const variantsTobeUpdated = variants?.filter((el) => el.id !== undefined);

      variantsTobeUpdated?.forEach((variant) => {
        if (variant.price !== undefined) {
          priceCases.push(
            sql`WHEN ${productVariants.id} = ${variant.id} THEN ${variant.price}`,
          );
          affectedIds.add(variant.id);
        }
        if (variant.discount !== undefined) {
          discountCases.push(
            sql`WHEN ${productVariants.id} = ${variant.id} THEN ${variant.discount}`,
          );
          affectedIds.add(variant.id);
        }
        if (variant.quantity !== undefined) {
          quantityCases.push(
            sql`WHEN ${productVariants.id} = ${variant.id} THEN ${variant.quantity}`,
          );
          affectedIds.add(variant.id);
        }
      });

      if (priceCases.length > 0) {
        updateVariantPayload.price = sql`(CASE ${sql.join(priceCases, sql` `)} ELSE ${productVariants.price} END)`;
      }
      if (discountCases.length > 0) {
        updateVariantPayload.discount = sql`(CASE ${sql.join(discountCases, sql` `)} ELSE ${productVariants.discount} END)`;
      }
      if (quantityCases.length > 0) {
        updateVariantPayload.quantity = sql`(CASE ${sql.join(quantityCases, sql` `)} ELSE ${productVariants.quantity} END)`;
      }

      // =================== variants' attributes ===================
      const updateVariantsAttrSQLChunks: SQL[] = [];

      const variantsAttrToUpdate = variantsTobeUpdated
        ?.filter((el) => el.attributes && Object.keys(el.attributes).length > 0)
        .flatMap((variant) =>
          Object.entries(variant.attributes!).map(([key, id]) => ({
            variantId: variant.id,
            key,
            attributeId: id,
          })),
        );

      variantsAttrToUpdate?.forEach((el) => {
        updateVariantsAttrSQLChunks.push(
          sql`WHEN ${productVariantsToAttributes.productVariantId} = ${el.variantId} AND ${productVariantsToAttributes.key} = ${el.key} THEN ${el.attributeId}`,
        );
      });

      const updateVariantAttrSQLConditions = variantsAttrToUpdate?.map((el) =>
        and(
          eq(productVariantsToAttributes.productVariantId, el.variantId),
          eq(productVariantsToAttributes.key, el.key),
        ),
      );

      // =================== images ===================
      const newImagesWithIds = await Promise.all(
        data.images
          ?.filter((img) => img.id === undefined)
          .map(async (img, i) => ({
            id: crypto.randomUUID(),
            buffer: await sharp(await img.file.arrayBuffer())
              .webp({ quality: 80 })
              .toBuffer(),
            path: `/images/products/${product.id}-${Date.now()}${i}.webp`,
            attributes: img.attributes,
          })) ?? [],
      );

      // =================== image's attributes ===================
      const newImagesAttrToInsert = newImagesWithIds?.flatMap((image) =>
        Object.entries(image.attributes).map(([key, id]) => ({
          imageId: image.id,
          key,
          attributeId: id,
        })),
      );

      const imagesToBeUpdated = data.images?.filter(
        (img) => img.id !== undefined,
      );

      const updateImagesAttrSQLChunks: SQL[] = [];

      const imagesAttrToUpdate = imagesToBeUpdated
        ?.filter((el) => Object.keys(el.attributes).length > 0)
        .flatMap((img) =>
          Object.entries(img.attributes!).map(([key, id]) => ({
            imageId: img.id,
            key,
            attributeId: id,
          })),
        );

      imagesAttrToUpdate?.forEach((el) => {
        updateImagesAttrSQLChunks.push(
          sql`WHEN ${imagesToAttributes.imageId} = ${el.imageId} AND ${imagesToAttributes.key} = ${el.key} THEN ${el.attributeId}`,
        );
      });

      const updateImageAttrSQLConditions = imagesAttrToUpdate?.map((el) =>
        and(
          eq(imagesToAttributes.imageId, el.imageId),
          eq(imagesToAttributes.key, el.key),
        ),
      );

      const allVariants = [
        ...dbProduct.variants
          .filter((el) => !data.variantsToDelete?.includes(el.id))
          .map((oldVar) => {
            const updatedVar = variantsTobeUpdated?.find(
              (el) => el.id === oldVar.id,
            );
            if (updatedVar) {
              return {
                id: updatedVar.id,
                touched: updatedVar.attributes ? true : false,
                attributes: {
                  ...Object.fromEntries(
                    oldVar.attributes.map(({ key, id }) => [key, id]),
                  ),
                  ...updatedVar.attributes,
                },
              };
            }
            return {
              id: oldVar.id,
              touched: false,
              attributes: Object.fromEntries(
                oldVar.attributes.map(({ key, id }) => [key, id]),
              ),
            };
          }),
        ...(newVariantsWithIds?.map((el) => ({ ...el, touched: true })) ?? []),
      ];

      const uniqueDbImages = Array.from(
        new Map(
          dbProduct.variants
            .flatMap((el) => el.images)
            .map((img) => [img.id, img]),
        ).values(),
      );

      const allImages = [
        ...uniqueDbImages
          .filter((el) => !data.imagesToDelete?.includes(el.id))
          .map((oldImg) => {
            const updatedImg = imagesToBeUpdated?.find(
              (el) => el.id === oldImg.id,
            );
            if (updatedImg) {
              return {
                id: updatedImg.id,
                touched: true,
                attributes: {
                  ...Object.fromEntries(
                    oldImg.attributes.map(({ key, id }) => [key, id]),
                  ),
                  ...updatedImg.attributes,
                },
              };
            }
            return {
              id: oldImg.id,
              touched: false,
              attributes: Object.fromEntries(
                oldImg.attributes.map(({ key, id }) => [key, id]),
              ),
            };
          }),
        ...(newImagesWithIds?.map((el) => ({ ...el, touched: true })) ?? []),
      ];

      // we look for images for each variant based on their attributes
      // if both variant and image are untouched, then the link between them is correct
      // if both variants are touched AND match their attributes then the link is correct
      // if a variant is touched but its matching image isn't then we should break all its existing links add the new link
      // if a variant is untouched but its image is touched then we should break all its existing links and add the new link
      const imageIdsLinksToBreak = new Set<string>();
      const variantIdsLinksToBreak = new Set<string>();
      const newVariantImageLinks: {
        imageId: string;
        productVariantId: string;
      }[] = [];
      for (const variant of allVariants) {
        const imagesWithSubsetVariants = allImages.filter((img) =>
          Object.values(img.attributes).every((a) =>
            Object.values(variant.attributes).includes(a),
          ),
        );

        if (imagesWithSubsetVariants.length === 0) {
          throw new OperationalError({
            code: ProductErrorCodes.InsuffecientImages,
            message: `Attempt to update product failed because at least one of the variants (${variant.id}) did not have an image`,
          });
        }

        for (const img of imagesWithSubsetVariants) {
          if (!img.touched && !variant.touched) {
            continue;
          }

          if (img.touched) {
            imageIdsLinksToBreak.add(img.id);
          }
          if (variant.touched) {
            variantIdsLinksToBreak.add(variant.id);
          }

          newVariantImageLinks.push({
            productVariantId: variant.id,
            imageId: img.id,
          });
        }
      }

      // =================== start of the transpaction ===================
      await this.store.db.transaction(async (tx) => {
        // updating the product
        await tx
          .update(products)
          .set({
            name: product.name,
            barcode: product.barcode,
            active: product.active,
            description: product.description,
            version: sql`(${product.version} + 1) % 1000`,
          })
          .where(eq(products.id, product.id));

        // updating the product's attributes
        if (updateProductAttrSQLChunks.length > 0) {
          await tx
            .update(productsToAttributes)
            .set({
              attributeId: sql`(CASE ${sql.join(updateProductAttrSQLChunks, sql` `)} ELSE ${productsToAttributes.attributeId} END)`,
            })
            .where(
              and(
                eq(productsToAttributes.productId, product.id),
                inArray(
                  productsToAttributes.key,
                  Object.keys(product.attributes!),
                ),
              ),
            );
        }

        // inserting new variants
        if (newVariantsToInsert?.length) {
          await tx.insert(productVariants).values(newVariantsToInsert);
        }

        // inserting new variant attribute links
        if (newVariantsAttrToInsert?.length) {
          await tx
            .insert(productVariantsToAttributes)
            .values(newVariantsAttrToInsert);
        }

        // update existing variants
        if (affectedIds.size > 0) {
          await tx
            .update(productVariants)
            .set({ ...updateVariantPayload })
            .where(inArray(productVariants.id, Array.from(affectedIds)));
        }

        // update variant attribute links
        if (
          updateVariantsAttrSQLChunks.length &&
          updateVariantAttrSQLConditions?.length
        ) {
          await tx
            .update(productVariantsToAttributes)
            .set({
              attributeId: sql`(CASE ${sql.join(updateVariantsAttrSQLChunks, sql` `)} ELSE ${productVariantsToAttributes.attributeId} END)`,
            })
            .where(or(...updateVariantAttrSQLConditions));
        }

        // insert new images
        if (newImagesWithIds?.length) {
          await tx
            .insert(images)
            .values(
              newImagesWithIds.map((img) => ({ id: img.id, path: img.path })),
            );
        }

        // insert new image attribute links
        if (newImagesAttrToInsert?.length) {
          await tx.insert(imagesToAttributes).values(newImagesAttrToInsert);
        }

        // update image attribute links
        if (
          updateImagesAttrSQLChunks.length > 0 &&
          updateImageAttrSQLConditions?.length
        ) {
          await tx
            .update(imagesToAttributes)
            .set({
              attributeId: sql`(CASE ${sql.join(updateImagesAttrSQLChunks, sql` `)} ELSE ${imagesToAttributes.attributeId} END)`,
            })
            .where(or(...updateImageAttrSQLConditions));
        }

        // update image variant links
        const variantImagesLinksToDeleteConds: SQL[] = [];
        if (imageIdsLinksToBreak.size > 0) {
          variantImagesLinksToDeleteConds.push(
            inArray(
              productVariantsToImages.imageId,
              Array.from(imageIdsLinksToBreak),
            ),
          );
        }
        if (variantIdsLinksToBreak.size > 0) {
          variantImagesLinksToDeleteConds.push(
            inArray(
              productVariantsToImages.productVariantId,
              Array.from(variantIdsLinksToBreak),
            ),
          );
        }

        if (variantImagesLinksToDeleteConds.length > 0) {
          await tx
            .delete(productVariantsToImages)
            .where(or(...variantImagesLinksToDeleteConds));
        }

        if (newVariantImageLinks.length > 0) {
          await tx.insert(productVariantsToImages).values(newVariantImageLinks);
        }

        if (data.imagesToDelete?.length) {
          await tx.delete(images).where(inArray(images.id, data.imagesToDelete));
        }
        if (data.variantsToDelete?.length) {
          await tx
            .delete(productVariants)
            .where(inArray(productVariants.id, data.variantsToDelete));
        }
      });

      for (const { path, buffer } of newImagesWithIds) {
        await Bun.write(`${this.store.dataPath}${path}`, buffer);
      }

      try {
        for (const path of imageFilesToDelete) {
          await Bun.file(`${this.store.dataPath}${path}`).delete();
        }
      } catch (e) {
        console.log(e);
      }
    } catch (e) {
      handleError(e);
    }
  }

  async deleteProduct(id: z.infer<typeof deleteProductParamSchema>) {
    try {
      const validatedId = deleteProductParamSchema.parse(id);

      const product = await this.store.db.query.products.findFirst({
        where: { id: validatedId },
        with: {
          variants: {
            columns: {},
            with: {
              images: true,
            },
          },
        },
      });

      if (!product) {
        throw new OperationalError({
          code: ProductErrorCodes.ProductNotFound,
          message: "Deleting a product failed because it does not exist",
        });
      }

      const imagesToDelete = product.variants.flatMap((el) => el.images);

      await this.store.db.transaction(async (tx) => {
        await tx.delete(products).where(eq(products.id, validatedId));

        await tx.delete(images).where(
          inArray(
            images.id,
            imagesToDelete.map((el) => el.id),
          ),
        );
      });

      try {
        for (const img of imagesToDelete) {
          await Bun.file(`${this.store.dataPath}/${img.path}`).delete();
        }
      } catch (e) {
        console.log(e);
      }
    } catch (e) {
      handleError(e);
    }
  }
}
