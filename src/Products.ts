import sharp from "sharp";
import type { createProductOptions, ProductImage } from "../types";
import type { Store } from "./Store";
import { ClothingProduct, Product } from "./db";
import type { Repository } from "typeorm";

export class Products {
  store: Store;
  repository: Repository<Product>;

  constructor(store: Store) {
    this.store = store;
    this.repository = store.dataSource.getRepository(Product);
  }

  async createProduct(p: createProductOptions, imgs: ProductImage[]) {
    try {
      const imageLinks: { color: string; filename: string }[] = [];
      imgs.forEach(async (img) => {
        const filename = `${p.name}-${img.color}-${Date.now()}`;

        await sharp(await img.image.arrayBuffer())
          .resize(500, 500, { fit: "fill" })
          .webp()
          .toFormat("webp")
          .toFile(`${this.store.dataPath}/images/products/${filename}.webp`);

        imageLinks.push({ color: img.color, filename });
      });

      const product = await ClothingProduct.create({
        name: p.name,
        barcode: p.barcode,
        active: p.active,
        description: p.description,
        category: p.category,
        tags: p.tags,
        gender: p.gender,
        options: p.options.map((o) => ({
          ...o,
          images: imageLinks
            .filter((img) => img.color === o.color)
            .map((img) => img.filename),
        })),
      }).save();

      return product;
    } catch (e) {
      console.log(e);
    }
  }
}
