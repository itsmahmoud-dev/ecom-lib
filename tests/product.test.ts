import { expect, test } from "bun:test";
import { faker } from "@faker-js/faker";
import { store } from ".";
import { ProductStatus, type UpdateProductParams } from "../src/types";
import { Product } from "../src/db";
import { readdirSync } from "fs";
import { OperError } from "../src/lib/OperError";
import { ProductErrorCodes } from "../src/types/error";

test("Create a product", async () => {
  const product = await store.products.createProduct({
    category: faker.word.adjective(),
    description: faker.commerce.productDescription(),
    name: faker.commerce.product(),
    status: ProductStatus.PENDING,
    barcode: faker.number.bigInt().toString(),
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
                "/home/mahmoud/Pictures/stuff from the server/image0-2.jpg",
              ).arrayBuffer(),
            ],
            "image1.png",
            { type: "image/jpg" },
          ),
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

  expect(product).toBeDefined();
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
  const testBarcode = (await store.products.repository.findOneBy({}))?.barcode;

  const result = store.products.createProduct({
    category: faker.word.adjective(),
    description: faker.commerce.productDescription(),
    name: faker.commerce.product(),
    status: ProductStatus.PENDING,
    barcode: testBarcode!,
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

test("Update a product", async () => {
  const [product] = await store.products.repository.find({ take: 1 });

  expect(product).toBeInstanceOf(Product);

  const newFields = {
    id: product!.id,
    name: faker.commerce.productName(),
    barcode: faker.number.bigInt().toString(),
    status: ProductStatus.ACTIVE,
    description: faker.commerce.productDescription(),
    category: faker.word.adjective(),
    imagesToDelete: [product?.options[0]?.images[0]!],
    options: [
      {
        ...product?.options[0]!,
        dirty: true,
        imagesData: [
          {
            file: new File(
              [
                await Bun.file(
                  "/home/mahmoud/Pictures/stuff from the server/image0.jpg",
                ).arrayBuffer(),
              ],
              "image1.png",
              { type: "image/jpg" },
            ),
          },
          {
            fileName: product?.options[0]?.images[1]!,
          },
        ],
      },
    ],
  } satisfies UpdateProductParams;

  const updatedProduct = await store.products.updateProduct({
    id: newFields.id,
    name: newFields.name,
    barcode: newFields.barcode,
    status: newFields.status,
    description: newFields.description,
    category: newFields.category,
    options: newFields.options,
    imagesToDelete: newFields.imagesToDelete,
  });

  expect(updatedProduct).toBeInstanceOf(Product);

  expect(updatedProduct.name).toBe(newFields.name);
  expect(updatedProduct.barcode).toBe(newFields.barcode);
  expect(updatedProduct.status).toBe(newFields.status);
  expect(updatedProduct.description).toBe(newFields.description);
  expect(updatedProduct.category).toBe(newFields.category);
  expect(updatedProduct.options).toHaveLength(newFields.options.length);

  // make sure that the original image has been deleted
  expect(readdirSync(`${store.dataPath}/images/products/`)).not.toContain(
    product?.options[0]?.images[0],
  );

  // make sure that the new image have been added
  expect(readdirSync(`${store.dataPath}/images/products/`)).toContain(
    updatedProduct?.options[0]?.images[0]!,
  );
});

test("Delete product", async () => {
  const [product] = await store.products.repository.find({ take: 1 });

  expect(product).toBeDefined();

  await store.products.deleteProduct(product!.id);
  const deletedProduct = await store.products.repository.findOneBy({
    id: product!.id,
  });

  expect(deletedProduct).toBeNull();
});
