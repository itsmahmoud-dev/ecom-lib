import sharp from "sharp";
import { and, eq, inArray, sql } from "drizzle-orm";

import {
  images,
  imagesToFacets,
  products,
  productsToFacets,
  productVariants,
  productVariantsToFacets,
  productVariantsToImages,
} from "./db/schema";
import { handleError, ProductErrorCodes, OperationalError } from "./lib/errors";

import { diffArrays } from "./lib/array";
import type { Store } from "./Store";

type InsertProductParams = {
  p: {
    name: string;
    barcode?: string | null;
    active: boolean;
    description: string;
    attributes: string[];
  };
  v: {
    price: number;
    discount?: number;
    attributes: string[];
  }[];
  i: {
    file: File;
    attributes: string[];
  }[];
};

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
    const imageBuffersToSave: { buffer: Buffer; filename: string }[] = [];
    try {
      await this.store.db.transaction(async (tx) => {
        // inserting the product
        const [product] = await tx
          .insert(products)
          .values({
            name: params.p.name,
            barcode: params.p.barcode,
            active: params.p.active,
            description: params.p.description,
          })
          .returning();

        if (!product) {
          throw new OperationalError({
            code: "",
            severity: "error",
            logMessage: "Error inserting a product",
            userMessage: "Something went wrong",
          });
        }

        // assigning attributes for the product
        await tx.insert(productsToFacets).values(
          params.p.attributes.map((id) => ({
            productId: product.id,
            facetId: id,
          })),
        );

        for (const el of params.v) {
          // inserting the variant
          const [variant] = await tx
            .insert(productVariants)
            .values({
              productId: product.id,
              price: el.price,
              discount: el.discount,
            })
            .returning();

          if (!variant) {
            throw new OperationalError({
              code: "",
              severity: "error",
              logMessage: "Error inserting a product variant",
              userMessage: "Something went wrong",
            });
          }

          // assigning attributes for the variant
          await tx.insert(productVariantsToFacets).values(
            el.attributes.map((id) => ({
              productVariantId: variant.id,
              facetId: id,
            })),
          );
        }

        const allVariantIds = await tx.query.productVariants.findMany({
          columns: { id: true },
          with: { attributes: { columns: { id: true } } },
          where: { productId: product.id },
        });

        // processing images and inserting them
        for (const [i, el] of params.i.entries()) {
          const filename = `/images/products/${product.id}-${i}-${Date.now()}.webp`;

          const [image] = await tx
            .insert(images)
            .values({ path: filename })
            .returning();

          if (!image) {
            throw new OperationalError({
              code: "",
              severity: "error",
              logMessage: "Error inserting a variant image",
              userMessage: "Something went wrong",
            });
          }

          imageBuffersToSave.push({
            buffer: await sharp(await el.file.arrayBuffer())
              .webp({ quality: 80 })
              .toBuffer(),
            filename,
          });

          // assgining significant facets to images
          await tx
            .insert(imagesToFacets)
            .values(
              el.attributes.map((id) => ({ imageId: image.id, facetId: id })),
            );

          const variantsWithSameAttributesIds = allVariantIds.filter((v) =>
            v.attributes.some((a) => el.attributes.includes(a.id)),
          );

          if (variantsWithSameAttributesIds.length) {
            await tx.insert(productVariantsToImages).values(
              variantsWithSameAttributesIds.map((variant) => ({
                imageId: image.id,
                productVariantId: variant.id,
              })),
            );
          }
        }
      });

      for (const { buffer, filename } of imageBuffersToSave) {
        await Bun.write(`${this.store.dataPath}${filename}`, buffer);
      }
    } catch (e) {
      handleError(e);
    }
  }

  async updateproduct(params: UpdateProductParams) {
    try {
      const imageBuffersToSave: { filename: string; buffer: Buffer }[] = [];

      await this.store.db.transaction(async (tx) => {
        // looking for the product
        const product = await tx.query.products.findFirst({
          where: { id: params.p.id },
          with: {
            attributes: true,
            variants: {
              with: {
                attributes: true,
                images: {
                  with: {
                    attributes: true,
                  },
                },
              },
            },
          },
        });

        // if not found throw
        if (!product) {
          throw new OperationalError({
            code: ProductErrorCodes.ProductNotFound,
            severity: "warning",
            userMessage: "Product was not found",
            logMessage: `Updating a product failed because it does not exist`,
            key: "id",
            value: params.p.id,
          });
        }

        if (product.version !== params.p.version) {
          throw new OperationalError({
            code: ProductErrorCodes.VersionMismatch,
            severity: "info",
            userMessage: "Please refresh and update again",
            logMessage: "Updating a product failed because of version mismatch",
            cause:
              "Product was updated by someone else after it loaded into the update form",
          });
        }

        // if found edit its fields
        const { attributes, id, ...productFieldsToUpdate } = params.p;

        // ---------------------------- editing product ----------------------------
        if (Object.keys(productFieldsToUpdate).length) {
          await tx
            .update(products)
            .set({
              ...productFieldsToUpdate,
              version: sql`(${product.version} + 1) % 1000`,
            })
            .where(eq(products.id, id));
        }

        // if there's attributes, then there's changed attributes
        if (attributes) {
          const oldAttributesIds = product.attributes.map((el) => el.id);

          const { added, removed } = diffArrays(oldAttributesIds, attributes);

          if (added.length) {
            await tx
              .insert(productsToFacets)
              .values(
                added.map((el) => ({ facetId: el, productId: product.id })),
              );
          }

          if (removed.length) {
            await tx
              .delete(productsToFacets)
              .where(
                and(
                  eq(productsToFacets.productId, product.id),
                  inArray(productsToFacets.facetId, removed),
                ),
              );
          }
        }

        // ---------------------------- editing variants ----------------------------
        if (params.v?.length) {
          for (const { id, attributes, discount, price } of params.v) {
            // update existing variant
            if (id) {
              const orignalVariant = product.variants.find((el) => el.id === id);

              if (!orignalVariant) {
                throw new OperationalError({
                  code: ProductErrorCodes.VariantNotFound,
                  severity: "warning",
                  userMessage: "One of the variants was not found",
                  logMessage: `Updating a variant failed because it does not exist`,
                  key: "id",
                  value: id,
                });
              }

              if (discount || price) {
                await tx
                  .update(productVariants)
                  .set({ discount, price })
                  .where(eq(productVariants.id, id));
              }

              if (attributes) {
                const originalAttributes = orignalVariant.attributes.map(
                  (el) => el.id,
                );

                const { added, removed } = diffArrays(
                  originalAttributes,
                  attributes,
                );

                if (added.length) {
                  await tx.insert(productVariantsToFacets).values(
                    added.map((el) => ({
                      productVariantId: id,
                      facetId: el,
                    })),
                  );
                }

                if (removed.length) {
                  await tx
                    .delete(productVariantsToFacets)
                    .where(
                      and(
                        eq(productVariantsToFacets.productVariantId, id),
                        inArray(productVariantsToFacets.facetId, removed),
                      ),
                    );
                }
              }
            }

            // insert new variant
            else if (!id && price && attributes?.length) {
              const [newVariant] = await tx
                .insert(productVariants)
                .values({
                  productId: product.id,
                  price: price,
                  discount: discount,
                })
                .returning();

              if (!newVariant) {
                throw new OperationalError({
                  code: "",
                  severity: "error",
                  logMessage: "Error inserting a variant",
                  userMessage: "Something went wrong",
                });
              }

              // assigning attributes for the variant
              await tx.insert(productVariantsToFacets).values(
                attributes.map((facetId) => ({
                  productVariantId: newVariant.id,
                  facetId,
                })),
              );
            }
          }
        }

        // ---------------------------- editing images ----------------------------
        if (params.i?.length) {
          const variants = await tx.query.productVariants.findMany({
            where: { productId: product.id },
            with: { attributes: true },
          });

          for (const [i, { file, attributes, id }] of params.i.entries()) {
            // updating existing image
            if (id) {
              const originalImage = product.variants
                .flatMap((el) => el.images)
                .find((img) => img.id === id);

              if (!originalImage) {
                throw new OperationalError({
                  code: ProductErrorCodes.ImageNotFound,
                  severity: "warning",
                  userMessage: "One of the images was not found",
                  logMessage: "Updating image failed because it does not exist",
                  key: "id",
                  value: id,
                });
              }

              const originalAttributes = originalImage.attributes.map(
                (el) => el.id,
              );

              const { added, removed } = diffArrays(
                originalAttributes,
                attributes,
              );

              if (added.length) {
                await tx.insert(imagesToFacets).values(
                  added.map((el) => ({
                    imageId: id,
                    facetId: el,
                  })),
                );
              }

              if (removed.length) {
                await tx
                  .delete(imagesToFacets)
                  .where(
                    and(
                      eq(imagesToFacets.imageId, id),
                      inArray(imagesToFacets.facetId, removed),
                    ),
                  );
              }
            }

            // inserting new image
            else if (file) {
              const filename = `/images/products/${product.id}-${i}-${Date.now()}.webp`;

              const [newImage] = await tx
                .insert(images)
                .values({ path: filename })
                .returning();

              if (!newImage) {
                throw new OperationalError({
                  code: "",
                  severity: "error",
                  logMessage: "Error inserting a product image",
                  userMessage: "Something went wrong",
                });
              }

              imageBuffersToSave.push({
                buffer: await sharp(await file.arrayBuffer())
                  .webp({ quality: 80 })
                  .toBuffer(),
                filename,
              });

              await tx.insert(imagesToFacets).values(
                attributes.map((el) => ({
                  facetId: el,
                  imageId: newImage.id,
                })),
              );

              const variantsWithSameAttributes = variants.filter((v) =>
                v.attributes.some((a) => attributes.includes(a.id)),
              );

              if (variantsWithSameAttributes.length) {
                await tx.insert(productVariantsToImages).values(
                  variantsWithSameAttributes.map((variant) => ({
                    imageId: newImage.id,
                    productVariantId: variant.id,
                  })),
                );
              }
            }
          }
        }
      });
      for (const { buffer, filename } of imageBuffersToSave) {
        await Bun.write(`${this.store.dataPath}${filename}`, buffer);
      }
    } catch (e) {
      handleError(e);
    }
  }

  async deleteProduct(id: string) {
    const [product] = await this.store.db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (!product) {
      throw new OperationalError({
        code: ProductErrorCodes.ProductNotFound,
        severity: "warning",
        userMessage: "Product was not found",
        logMessage: "Deleting product failed because it does not exist",
        key: "id",
        value: id,
      });
    }
  }
}
