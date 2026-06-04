import sharp from "sharp";

import { Product, ProductOption } from "./db";
import { extractKeyValue, slugify } from "./lib/string";
import { ProductEvents } from "./types/events";
import { QueryFailedError, type Repository } from "typeorm";
import { OperError } from "./lib/OperError";
import { ProductErrorCodes } from "./types/error";

import type { Store } from "./Store";
import type { CreateProductParams } from "./types";

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
          category: p.category,
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
}
