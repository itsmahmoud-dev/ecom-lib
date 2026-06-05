import sharp from "sharp";
import { renameSync, rmSync } from "fs";

import { Product, ProductOption } from "./db";
import { extractKeyValue, slugify } from "./lib/string";
import { ProductEvents } from "./types/events";
import { Not, QueryFailedError, type Repository } from "typeorm";
import { OperError } from "./lib/OperError";
import { ProductErrorCodes } from "./types/error";

import type { Store } from "./Store";
import type { CreateProductParams, UpdateProductParams } from "./types";

export class Products {
  store: Store;
  repository: Repository<Product>;

  constructor(store: Store) {
    this.store = store;
    this.repository = store.dataSource.getRepository(Product);
  }

  /**
   *
   * @param p CreateProductParams
   * @returns the created product
   * @throws a P600 error if the barcode already exists
   * @emits ProductEvents.CREATED
   */
  async createProduct(p: CreateProductParams) {
    try {
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

      const options = await Promise.all(
        p.options.map(async (option) => {
          const images = await Promise.all(
            option.images.map(async (img, j) => {
              const { type, ...restAttrs } = option.attributes;
              const attrs = Object.values(restAttrs);

              const filename = `${slugify(p.name)}-${attrs.map((el) => slugify(el)).join("-")}-${Date.now()}${j}.webp`;

              await sharp(await img.arrayBuffer())
                .resize(500, 500, { fit: "fill" })
                .webp()
                .toFile(`${this.store.dataPath}/images/products/${filename}`);

              return filename;
            }),
          );

          return ProductOption.create({
            attributes: option.attributes,
            price: option.price,
            discount: option.discount,
            images,
          });
        }),
      );

      const product = await this.repository
        .create({
          name: p.name,
          barcode: p.barcode,
          status: p.status,
          description: p.description,
          attributes: p.attributes,
          options,
        })
        .save();

      this.store.emitter.emit(ProductEvents.CREATED, product);

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
   * @param params UpdateProductParams
   * @returns the updated product
   * @throws a P600 error if the new barcode belongs to a different product
   * @throws a P601 error if no product with the given id exists
   * @emits ProductEvents.UPDATED
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

    const { options, ...fieldsToUpdate } = params;

    Object.assign(product, { ...fieldsToUpdate });

    // delete images marked for deletion, if any
    if (params.imagesToDelete && params.imagesToDelete.length > 0) {
      params.imagesToDelete.forEach((fileName) => {
        rmSync(`${this.store.dataPath}/images/products/${fileName}`, {
          force: true,
        });
      });
    }

    if (options && options.length > 0) {
      const newOptions = await Promise.all(
        options.map(async (o) => {
          const { attributes, price, discount } = o;
          const images = await Promise.all(
            o.imagesData.map(async (imageData, i) => {
              const { type, ...restAttrs } = attributes;
              const attrs = Object.values(restAttrs);
              const filename = `${slugify(product.name)}-${attrs.map((el) => slugify(el)).join("-")}-${Date.now()}${i}.webp`;

              // if the image is a file, resize and save it
              if (imageData.file) {
                await sharp(await imageData.file.arrayBuffer())
                  .resize(500, 500, { fit: "fill" })
                  .webp()
                  .toFile(`${this.store.dataPath}/images/products/${filename}`);

                return filename;
              }

              // if the image is not a file, but the option is marked as dirty, rename it
              if (o.dirty && imageData.fileName) {
                renameSync(
                  `${this.store.dataPath}/images/products/${imageData.fileName}`,
                  `${this.store.dataPath}/images/products/${filename}`,
                );
                return filename;
              }

              return imageData.fileName!;
            }),
          );

          const option = product.options.find((el) => el.id === o.id)!;
          if (option)
            Object.assign(option, { attributes, price, discount, images });

          return option;
        }),
      );
      if (newOptions) product.options = newOptions;
    }

    await product.save();

    this.store.emitter.emit(ProductEvents.UPDATED, product);

    return product;
  }

  /**
   * @param id the id of the product to delete
   * @throws a P601 error if no product with the given id exists
   * @emits ProductEvents.DELETED
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

    this.store.emitter.emit(ProductEvents.DELETED, product);
  }
}
