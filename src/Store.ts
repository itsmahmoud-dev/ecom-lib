import "reflect-metadata";
import { DataSource, Repository } from "typeorm";
import { ClothingProduct } from "./db/clothing/clothingProduct";
import { Product } from "./db/product";
import { ClothingProductOption } from "./db/clothing/clothingProductOption";
import type { createProductOptions, ProductImage } from "../types/product";
import sharp from "sharp";

type storeProps = {
  name: string;
  dataPath: string;
  db: {
    PORT: number;
    NAME: string;
    USER: string;
    PASS: string;
    HOST: string;
  };
};

export class Store {
  name: string;
  dataSource: DataSource;
  dataPath: string;

  constructor(props: storeProps) {
    this.name = props.name;
    this.dataPath = props.dataPath;
    this.dataSource = new DataSource({
      type: "postgres",
      host: props.db.HOST,
      port: props.db.PORT,
      username: props.db.USER,
      password: props.db.PASS,
      database: props.db.NAME,
      entities: [Product, ClothingProduct, ClothingProductOption],
      synchronize: true,
      logging: false,
    });

    try {
      this.dataSource.initialize();
    } catch (e) {
      console.log(e);
    }
  }

  async createProduct(p: createProductOptions, imgs: ProductImage[]) {
    const imageLinks: { color: string; filename: string }[] = [];
    imgs.forEach(async (img) => {
      const filename = `${p.name}-${img.color}-${Date.now()}`;
      await sharp(await img.image.arrayBuffer())
        .resize(500, 500, { fit: "fill" })
        .webp()
        .toFormat("webp")
        .toFile(`${this.dataPath}/images/products/${filename}.webp`);
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
  }
}
