import { expect, test } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { OperError } from "../src/lib/OperError";
import { ProductErrorCodes } from "../src/lib/errors";

function makeImageFile(filename: string, type: string): File {
  const buffer = readFileSync(join(import.meta.dir, filename));
  return new File([buffer], filename, { type });
}

test("Create a product with red and blue t-shirt variants", async () => {
  const redImage = makeImageFile("red-t-shirt.webp", "image/webp");
  const blueImage = makeImageFile("blue-t-shirt.jpeg", "image/jpeg");

  const productName = faker.commerce.productName();

  await store.products.createProduct({
    name: productName,
    barcode: faker.string.alphanumeric(12),
    description: faker.commerce.productDescription(),
    attributes: { type: "t-shirt" },
    active: true,
    variants: [
      {
        attributes: { color: "red" },
        price: 19.99,
        discount: 0,
        images: [redImage],
      },
      {
        attributes: { color: "blue" },
        price: 24.99,
        discount: 5,
        images: [blueImage],
      },
    ],
  });

  const product = await store.db.query.products.findFirst({
    where: (p, { eq }) => eq(p.name, productName),
    with: { variants: true },
  });

  expect(product).toBeDefined();
  expect(product).toMatchObject({
    name: productName,
    active: true,
    attributes: { type: "t-shirt" },
  });
  expect(product!.variants).toHaveLength(2);

  const redVariant = product!.variants.find(
    (v) => (v.attributes as Record<string, string>).color === "red",
  );
  const blueVariant = product!.variants.find(
    (v) => (v.attributes as Record<string, string>).color === "blue",
  );

  expect(redVariant).toBeDefined();
  expect(redVariant).toMatchObject({ price: 19.99, discount: 0 });
  expect(redVariant!.images).toHaveLength(1);
  expect(
    existsSync(
      `${store.dataPath}/images/products/${redVariant!.images[0]}.webp`,
    ),
  ).toBe(true);

  expect(blueVariant).toBeDefined();
  expect(blueVariant).toMatchObject({ price: 24.99, discount: 5 });
  expect(blueVariant!.images).toHaveLength(1);
  expect(
    existsSync(
      `${store.dataPath}/images/products/${blueVariant!.images[0]}.webp`,
    ),
  ).toBe(true);
});

test("Create a product with a duplicate barcode", async () => {
  const redImage = makeImageFile("red-t-shirt.webp", "image/webp");
  const barcode = faker.string.alphanumeric(12);

  await store.products.createProduct({
    name: faker.commerce.productName(),
    barcode,
    description: faker.commerce.productDescription(),
    attributes: {},
    active: true,
    variants: [
      {
        attributes: { color: "red" },
        price: 19.99,
        discount: 0,
        images: [redImage],
      },
    ],
  });

  const result = store.products.createProduct({
    name: faker.commerce.productName(),
    barcode,
    description: faker.commerce.productDescription(),
    attributes: {},
    active: true,
    variants: [
      {
        attributes: { color: "red" },
        price: 19.99,
        discount: 0,
        images: [redImage],
      },
    ],
  });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.BarcodeAlreadyExists,
    message: expect.any(String),
  });
});
