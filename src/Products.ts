import sharp from "sharp";
import { renameSync, rmSync } from "fs";
import { Not, QueryFailedError } from "typeorm";

import { Product, ProductOption } from "./db";
import { extractKeyValue, slugify } from "./lib/string";
import { OperError } from "./lib/OperError";
import { ProductErrorCodes } from "./types/error";

import type { Store } from "./Store";
import type { CreateProductParams, UpdateProductParams } from "./types";
import type { Repository } from "typeorm";

export class Products<
  productFacetKeys extends string[],
  productOptionFacetKeys extends string[],
> {
  store: Store<productFacetKeys, productOptionFacetKeys>;
  repository: Repository<Product<productFacetKeys, productOptionFacetKeys>>;
  optionsRepository: Repository<ProductOption<productOptionFacetKeys>>;

  constructor(store: Store<productFacetKeys, productOptionFacetKeys>) {
    this.store = store;
    this.repository = store.dataSource.getRepository(Product);
    this.optionsRepository = store.dataSource.getRepository(ProductOption);
  }

  /**
   * Creates a new product.
   * @param p CreateProductParams
   * @returns the created product
   * @throws a P600 error if the barcode already exists
   */
  async createProduct(
    p: CreateProductParams<productFacetKeys, productOptionFacetKeys>,
  ) {
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
              const attrs = Object.values<string>(option.attributes);

              const filename = `${slugify(p.name)}-${attrs.map((el) => slugify(el)).join("-")}-${Date.now()}${j}.webp`;

              await sharp(await img.arrayBuffer())
                .resize(500, 500, { fit: "fill" })
                .webp()
                .toFile(`${this.store.dataPath}/images/products/${filename}`);

              return filename;
            }),
          );

          return this.optionsRepository.create({
            attributes: option.attributes,
            price: option.price,
            discount: option.discount,
            images,
          });
        }),
      );

      const product = new Product<productFacetKeys, productOptionFacetKeys>();

      Object.assign(product, {
        name: p.name,
        barcode: p.barcode,
        status: p.status,
        description: p.description,
        attributes: p.attributes,
        options,
      });

      await product.save();

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
   * @throws a P600 error if the new barcode belongs to a different product
   * @throws a P601 error if no product with the given id exists
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

              // * if the image is a file, resize and save it
              if (imageData.file) {
                await sharp(await imageData.file.arrayBuffer())
                  .resize(500, 500, { fit: "fill" })
                  .webp()
                  .toFile(`${this.store.dataPath}/images/products/${filename}`);

                return filename;
              }

              // * if the image is not a file, but the option is marked as dirty, rename it
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

    return product;
  }

  /**
   * Deletes a product by its id.
   * @param id the id of the product to delete
   * @throws a P601 error if no product with the given id exists
   */
  async deleteProduct(id: number) {
    const product = await this.repository.findOneBy({ id });
    if (!product) {
      throw new OperError({
        code: ProductErrorCodes.ProductNotFound,
        message: "Product not found",
      });
    }

    await product.remove();
  }
}
