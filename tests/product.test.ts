import { afterAll, expect, test } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { OperError } from "../src/lib/OperError";
import { ProductErrorCodes } from "../src/lib/errors";
import { facets, images, products } from "../src/db/schema";

function makeImageFile(filename: string, type: string): File {
  const buffer = readFileSync(join(import.meta.dir, filename));
  return new File([buffer], filename, { type });
}

test("Add a product with red and blue variants and images", async () => {
  const typeFacet = await store.facets.addFacet({
    key: "type",
    value: faker.string.alphanumeric(8),
  });
  const redFacet = await store.facets.addFacet({
    key: "color",
    value: `red-${faker.string.alphanumeric(8)}`,
  });
  const blueFacet = await store.facets.addFacet({
    key: "color",
    value: `blue-${faker.string.alphanumeric(8)}`,
  });

  const redImage = makeImageFile("red-t-shirt.webp", "image/webp");
  const blueImage = makeImageFile("blue-t-shirt.jpeg", "image/jpeg");

  const productName = faker.commerce.productName();
  const barcode = faker.string.alphanumeric(12);

  await store.products.addProduct({
    p: {
      name: productName,
      barcode,
      active: true,
      description: faker.commerce.productDescription(),
      attributes: [typeFacet!.id],
    },
    v: [
      { price: 19.99, discount: 0, attributes: [redFacet!.id] },
      { price: 24.99, discount: 5, attributes: [blueFacet!.id] },
    ],
    i: [
      { file: redImage, attributes: [redFacet!.id] },
      { file: blueImage, attributes: [blueFacet!.id] },
    ],
  });

  const product = await store.db.query.products.findFirst({
    where: { name: productName },
    with: {
      attributes: true,
      variants: {
        with: { attributes: true, images: { with: { attributes: true } } },
      },
    },
  });

  expect(product).toBeDefined();
  expect(product!.barcode).toBe(barcode);
  expect(product!.attributes).toHaveLength(1);
  expect(product!.attributes[0]!.id).toBe(typeFacet!.id);
  expect(product!.variants).toHaveLength(2);

  const redVariant = product!.variants.find((v) =>
    v.attributes.some((a) => a.id === redFacet!.id),
  );
  const blueVariant = product!.variants.find((v) =>
    v.attributes.some((a) => a.id === blueFacet!.id),
  );

  expect(redVariant).toMatchObject({ price: 19.99, discount: 0 });
  expect(redVariant!.images).toHaveLength(1);
  expect(existsSync(`${store.dataPath}${redVariant!.images[0]!.path}`)).toBe(
    true,
  );

  expect(blueVariant).toMatchObject({ price: 24.99, discount: 5 });
  expect(blueVariant!.images).toHaveLength(1);
  expect(existsSync(`${store.dataPath}${blueVariant!.images[0]!.path}`)).toBe(
    true,
  );
});

test("Update a product's fields, attributes, variants and images", async () => {
  const typeFacet = await store.facets.addFacet({
    key: "type",
    value: faker.string.alphanumeric(8),
  });
  const redFacet = await store.facets.addFacet({
    key: "color",
    value: `red-${faker.string.alphanumeric(8)}`,
  });
  const blueFacet = await store.facets.addFacet({
    key: "color",
    value: `blue-${faker.string.alphanumeric(8)}`,
  });
  const greenFacet = await store.facets.addFacet({
    key: "color",
    value: `green-${faker.string.alphanumeric(8)}`,
  });

  const productName = faker.commerce.productName();
  const redImage = makeImageFile("red-t-shirt.webp", "image/webp");
  const greenImage = makeImageFile("blue-t-shirt.jpeg", "image/jpeg");

  await store.products.addProduct({
    p: {
      name: productName,
      active: true,
      description: faker.commerce.productDescription(),
      attributes: [typeFacet!.id],
    },
    v: [{ price: 19.99, discount: 0, attributes: [redFacet!.id] }],
    i: [{ file: redImage, attributes: [redFacet!.id] }],
  });

  const created = await store.db.query.products.findFirst({
    where: { name: productName },
    with: {
      attributes: true,
      variants: {
        with: { attributes: true, images: { with: { attributes: true } } },
      },
    },
  });

  expect(created).toBeDefined();
  const originalVariant = created!.variants[0]!;
  const originalImage = originalVariant.images[0]!;

  const newName = faker.commerce.productName();

  await store.products.updateproduct({
    p: {
      id: created!.id,
      name: newName,
      attributes: [blueFacet!.id],
    },
    v: [
      {
        id: originalVariant.id,
        price: 29.99,
        discount: 0,
        attributes: [blueFacet!.id],
      },
      { price: 34.99, discount: 0, attributes: [greenFacet!.id] },
    ],
    i: [
      { id: originalImage.id, attributes: [blueFacet!.id] },
      { file: greenImage, attributes: [greenFacet!.id] },
    ],
  });

  const updated = await store.db.query.products.findFirst({
    where: { id: created!.id },
    with: {
      attributes: true,
      variants: {
        with: { attributes: true, images: { with: { attributes: true } } },
      },
    },
  });

  expect(updated).toBeDefined();
  expect(updated!.name).toBe(newName);
  expect(updated!.attributes).toHaveLength(1);
  expect(updated!.attributes[0]!.id).toBe(blueFacet!.id);
  expect(updated!.variants).toHaveLength(2);

  const updatedVariant = updated!.variants.find(
    (v) => v.id === originalVariant.id,
  )!;
  const newVariant = updated!.variants.find((v) => v.id !== originalVariant.id)!;

  expect(updatedVariant).toMatchObject({ price: 29.99, discount: 0 });
  expect(updatedVariant.attributes).toHaveLength(1);
  expect(updatedVariant.attributes[0]!.id).toBe(blueFacet!.id);

  expect(newVariant).toMatchObject({ price: 34.99, discount: 0 });
  expect(newVariant.attributes).toHaveLength(1);
  expect(newVariant.attributes[0]!.id).toBe(greenFacet!.id);

  const updatedImage = updatedVariant.images.find(
    (img) => img.id === originalImage.id,
  );
  expect(updatedImage).toBeDefined();
  expect(updatedImage!.attributes).toHaveLength(1);
  expect(updatedImage!.attributes[0]!.id).toBe(blueFacet!.id);

  expect(newVariant.images).toHaveLength(1);
  expect(existsSync(`${store.dataPath}${newVariant.images[0]!.path}`)).toBe(
    true,
  );
});

test("Add a product with a duplicate barcode", async () => {
  const barcode = faker.string.alphanumeric(12);

  await store.db.insert(products).values({
    name: faker.commerce.productName(),
    barcode,
    active: true,
    description: faker.commerce.productDescription(),
  });

  const result = store.products.addProduct({
    p: {
      name: faker.commerce.productName(),
      barcode,
      active: true,
      description: faker.commerce.productDescription(),
      attributes: [],
    },
    v: [],
    i: [],
  });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.BarcodeAlreadyExists,
    message: expect.any(String),
  });
});

test("Update a product that doesn't exist", async () => {
  const result = store.products.updateproduct({
    p: { id: faker.string.uuid(), name: faker.commerce.productName() },
  });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.ProductNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Update a product with a duplicate barcode", async () => {
  const barcode = faker.string.alphanumeric(12);

  await store.db.insert(products).values({
    name: faker.commerce.productName(),
    barcode,
    active: true,
    description: faker.commerce.productDescription(),
  });

  const [product] = await store.db
    .insert(products)
    .values({
      name: faker.commerce.productName(),
      active: true,
      description: faker.commerce.productDescription(),
    })
    .returning();

  expect(product).toBeDefined();

  const result = store.products.updateproduct({
    p: { id: product!.id, barcode },
  });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.BarcodeAlreadyExists,
    message: expect.any(String),
  });
});

test("Update a variant that doesn't exist", async () => {
  const [product] = await store.db
    .insert(products)
    .values({
      name: faker.commerce.productName(),
      active: true,
      description: faker.commerce.productDescription(),
    })
    .returning();

  expect(product).toBeDefined();

  const result = store.products.updateproduct({
    p: { id: product!.id },
    v: [{ id: faker.string.uuid(), price: 19.99 }],
  });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.VariantNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Update an image that doesn't exist", async () => {
  const [product] = await store.db
    .insert(products)
    .values({
      name: faker.commerce.productName(),
      active: true,
      description: faker.commerce.productDescription(),
    })
    .returning();

  expect(product).toBeDefined();

  const result = store.products.updateproduct({
    p: { id: product!.id },
    i: [{ id: faker.string.uuid(), attributes: [] }],
  });

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: ProductErrorCodes.ImageNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

afterAll(async () => {
  await store.db.delete(products);
  await store.db.delete(images);
  await store.db.delete(facets);
  await Bun.$`rm -f ${store.dataPath}/images/products/*`.quiet().nothrow();
});
