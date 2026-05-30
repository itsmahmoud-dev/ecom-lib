import { expect, test } from "bun:test";
import { faker } from "@faker-js/faker";
import { store } from ".";
import { ProductStatus } from "../src/types";
import { Product } from "../src/db";
import { readdirSync } from "fs";
import { OperError } from "../src/lib/OperError";
import { ProductErrorCodes } from "../src/types/error";

const testBarcode = faker.number.bigInt().toString();

test("Create a product", async () => {
  const product = await store.products.createProduct({
    category: faker.word.adjective(),
    description: faker.commerce.productDescription(),
    name: faker.commerce.product(),
    status: ProductStatus.PENDING,
    barcode: testBarcode,
    options: [
      {
        price: Number(faker.commerce.price()),
        discount: 0,
        attributes: {
          type: "clothing",
          color: faker.color.human(),
          size: "XXL",
        },
        images: [
          new File(
            [
              await Bun.file(
                "/home/mahmoud/Pictures/stuff from the server/don't simp.jpg",
              ).arrayBuffer(),
            ],
            "image.png",
            { type: "image/jpg" },
          ),
        ],
      },
    ],
  });

  expect(product).not.toBeUndefined();
  expect(product).toBeInstanceOf(Product);
  expect(product!.options).toBeArray();
  product!.options.forEach((o) => {
    expect(o.price).toBePositive();
  });
  expect(
    readdirSync(`${store.dataPath}/images/products`).length,
  ).toBeGreaterThan(0);
});

test("Create a product with a duplicate barcode", async () => {
  const result = store.products.createProduct({
    category: faker.word.adjective(),
    description: faker.commerce.productDescription(),
    name: faker.commerce.product(),
    status: ProductStatus.PENDING,
    barcode: testBarcode,
    options: [
      {
        price: Number(faker.commerce.price()),
        discount: 0,
        attributes: {
          type: "clothing",
          color: faker.color.human(),
          size: "XXL",
        },
        images: [
          new File(
            [
              await Bun.file(
                "/home/mahmoud/Pictures/stuff from the server/don't simp.jpg",
              ).arrayBuffer(),
            ],
            "image.png",
            { type: "image/jpg" },
          ),
        ],
      },
    ],
  });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.BarcodeAlreadyExists,
  });
});
