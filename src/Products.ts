import sharp from "sharp";
import { renameSync, rmSync } from "fs";
import { Not, QueryFailedError } from "typeorm";

import { Product, ProductVariant } from "./db";
import { extractKeyValue, slugify } from "./lib/string";
import { OperError } from "./lib/OperError";
import { ProductErrorCodes } from "./types/error";

import type { Store } from "./Store";
import type { CreateProductParams, UpdateProductParams } from "./types";
import type { Repository } from "typeorm";

export class Products {
  store: Store;
  repository: Repository<Product>;
  variantRepository: Repository<ProductVariant>;

  constructor(store: Store) {
    this.store = store;
    this.repository = store.dataSource.getRepository(Product);
    this.variantRepository = store.dataSource.getRepository(ProductVariant);
  }

  /**
   * Creates a new product.
   * @param p CreateProductParams
   * @returns the created product
   * @throws {OperError} with code P600 if the barcode already exists
   */
  async createProduct(p: CreateProductParams) {
    try {
      if (p.barcode) {
        const exists = await this.repository.existsBy({ barcode: p.barcode });

        if (exists) {
          throw new OperError({
            code: ProductErrorCodes.BarcodeAlreadyExists,
            message: "Barcode already exists",
            cause: "The barcode is already in use",
            key: "barcode",
            value: p.barcode,
          });
        }
      }

      const variants = await Promise.all(
        p.variants.map(async (v) => {
          const images = await Promise.all(
            v.images.map(async (img, j) => {
              const attrs = Object.values(v.attributes);

              const filename = `${slugify(p.name)}-${attrs.map((el) => slugify(el)).join("-")}-${Date.now()}${j}.webp`;

              await sharp(await img.arrayBuffer())
                .resize(500, 500, { fit: "fill" })
                .webp()
                .toFile(`${this.store.dataPath}/images/products/${filename}`);

              return filename;
            }),
          );

          return this.variantRepository.create({
            attributes: v.attributes,
            price: v.price,
            discount: v.discount,
            images,
          });
        }),
      );

      const product = this.repository.create({
        name: p.name,
        barcode: p.barcode,
        status: p.status,
        description: p.description,
        attributes: p.attributes,
        variants,
      });

      await this.repository.save(product);

      return product;
    } catch (err) {
      if (err instanceof QueryFailedError && err.driverError.code === "23505") {
        const [key, value] = extractKeyValue(err.driverError.detail);
        throw new OperError({
          code: ProductErrorCodes.BarcodeAlreadyExists,
          message: "Barcode alreay exists",
          cause:
            "The user is trying to create a product with a duplicate barcode",
          key,
          value,
        });
      }
      throw err;
    }
  }

  /**
   * Updates an existing product.
   * @param params UpdateProductParams
   * @returns the updated product
   * @throws {OperError} with code P600 if the new barcode belongs to a different product
   * @throws {OperError} with code P601 if no product with the given id exists
   */
  async updateProduct(params: UpdateProductParams) {
    const barcode = params.barcode;

    if (
      barcode &&
      (await this.repository.existsBy({ barcode, id: Not(params.id) }))
    ) {
      throw new OperError({
        code: ProductErrorCodes.BarcodeAlreadyExists,
        message: "Barcode alreay exists",
        cause:
          "The user is trying to update a product with a duplicate barcode",
        key: "barcode",
        value: barcode,
      });
    }

    const product = await this.repository.findOneBy({ id: params.id });

    if (!product)
      throw new OperError({
        code: ProductErrorCodes.ProductNotFound,
        message: "Product not found",
        cause: "The product with the given id does not exist",
      });

    const { variants, ...fieldsToUpdate } = params;

    Object.assign(product, { ...fieldsToUpdate });

    // delete images marked for deletion, if any
    if (params.imagesToDelete && params.imagesToDelete.length > 0) {
      params.imagesToDelete.forEach((fileName) => {
        rmSync(`${this.store.dataPath}/images/products/${fileName}`, {
          force: true,
        });
      });
    }

    if (variants && variants.length > 0) {
      const newVariants = await Promise.all(
        variants.map(async (v) => {
          const { attributes, price, discount } = v;
          const images = await Promise.all(
            v.imagesData.map(async (imageData, i) => {
              const { type, ...restAttrs } = attributes;
              const attrs = Object.values(restAttrs);
              const filename = `${slugify(product.name)}-${attrs.map((el) => slugify(el)).join("-")}-${Date.now()}${i}.webp`;

              // * if the image is a file, resize and save it
              if (imageData.file) {
                await sharp(await imageData.file.arrayBuffer())
                  .resize(500, 500, { fit: "fill" })
                  .webp()
                  .toFile(`${this.store.dataPath}/images/products/${filename}`);

                return filename;
              }

              // * if the image is not a file, but the option is marked as dirty, rename it
              if (v.dirty && imageData.fileName) {
                renameSync(
                  `${this.store.dataPath}/images/products/${imageData.fileName}`,
                  `${this.store.dataPath}/images/products/${filename}`,
                );
                return filename;
              }

              return imageData.fileName!;
            }),
          );

          const variant = product.variants.find((el) => el.id === v.id)!;
          if (variant)
            Object.assign(variant, { attributes, price, discount, images });

          return variant;
        }),
      );
      if (newVariants) product.variants = newVariants;
    }

    await this.repository.save(product);

    return product;
  }

  /**
   * Deletes a product by its id.
   * @param id the id of the product to delete
   * @throws {OperError} with code P601 if no product with the given id exists
   */
  async deleteProduct(id: number) {
    const product = await this.repository.findOneBy({ id });
    if (!product) {
      throw new OperError({
        code: ProductErrorCodes.ProductNotFound,
        message: "Product not found",
      });
    }

    await this.repository.remove(product);
  }
}
