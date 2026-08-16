import { afterAll, describe, expect, test } from "bun:test";
import { join } from "path";
import { faker } from "@faker-js/faker";
import { store } from ".";
import {
  attributes,
  images,
  imagesToAttributes,
  products,
  productsToAttributes,
  productVariants,
  productVariantsToAttributes,
  productVariantsToImages,
} from "../src/db/schema";
import { AttributeErrorCodes, ProductErrorCodes } from "../src/utils/errors";
import type z from "zod";
import type { updateProductSchema } from "../src/types/products.type";

async function makeProduct(
  product: typeof products.$inferInsert,
  attrs: Record<string, string>,
) {
  const [dbProduct] = await store.db
    .insert(products)
    .values(product)
    .returning();
  await store.db.insert(productsToAttributes).values(
    Object.entries(attrs).map(([key, id]) => ({
      productId: dbProduct!.id,
      attributeId: id,
      key,
    })),
  );
  return {
    ...dbProduct!,
    attributes: attrs,
  };
}

async function makeVariant(
  variant: typeof productVariants.$inferInsert,
  attrs: Record<string, string>,
) {
  const [dbVariant] = await store.db
    .insert(productVariants)
    .values(variant)
    .returning();
  await store.db.insert(productVariantsToAttributes).values(
    Object.entries(attrs).map(([key, id]) => ({
      productVariantId: dbVariant!.id,
      attributeId: id,
      key,
    })),
  );
  return {
    ...dbVariant!,
    attributes: attrs,
  };
}

async function makeImage(
  image: typeof images.$inferInsert,
  attrs: Record<string, string>,
) {
  await Bun.write(
    `${store.dataPath}/images/products/${image.path}`,
    await Bun.file(join(import.meta.dirname, `./${image.path}`)).arrayBuffer(),
  );
  const [dbImage] = await store.db
    .insert(images)
    .values({
      ...image,
      path: `/images/products/${image.path}`,
    })
    .returning();
  await store.db.insert(imagesToAttributes).values(
    Object.entries(attrs).map(([key, id]) => ({
      imageId: dbImage!.id,
      attributeId: id,
      key,
    })),
  );

  return {
    ...dbImage!,
    attributes: attrs,
  };
}

async function makeImageVariantLinks(
  links: { imageId: string; productVariantId: string }[],
) {
  await store.db.insert(productVariantsToImages).values(links);
}

async function makeAttribute(key: string, value: string) {
  return (
    (await store.db.query.attributes.findFirst({ where: { key, value } })) ??
    (await store.attributes.addAttribute({ key, value }))
  );
}

async function getFile(path: string) {
  return new File([Bun.file(path)], path);
}

describe("store.products.addProduct", () => {
  describe("Given valid input", () => {
    test("Add a product, with variants and images", async () => {
      const whiteColorAttr = await makeAttribute("color", "white");
      const blackColorAttr = await makeAttribute("color", "black");
      const techCategoryAttr = await makeAttribute("category", "tech");
      const storage128Attr = await makeAttribute("storage", "128");
      const storage256Attr = await makeAttribute("storage", "256");
      const ram6Attr = await makeAttribute("ram", "6");
      const ram8Attr = await makeAttribute("ram", "8");
      const productName = faker.commerce.productName();

      const data = {
        product: {
          name: productName,
          active: true,
          description: faker.commerce.productDescription(),
          barcode: faker.string.numeric(12),
          attributes: { [techCategoryAttr.key]: techCategoryAttr.id },
        },
        variants: [
          {
            price: 1100,
            quantity: 12,
            discount: 0,
            attributes: {
              [blackColorAttr.key]: blackColorAttr.id,
              [storage128Attr.key]: storage128Attr.id,
              [ram6Attr.key]: ram6Attr.id,
            },
          },
          {
            price: 1200,
            quantity: 10,
            discount: 0,
            attributes: {
              [storage256Attr.key]: storage256Attr.id,
              [ram8Attr.key]: ram8Attr.id,
              [whiteColorAttr.key]: whiteColorAttr.id,
            },
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: { [blackColorAttr.key]: blackColorAttr.id },
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-2.webp"),
            ),
            attributes: { [blackColorAttr.key]: blackColorAttr.id },
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-white-1.webp"),
            ),
            attributes: { [whiteColorAttr.key]: whiteColorAttr.id },
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-white-2.webp"),
            ),
            attributes: { [whiteColorAttr.key]: whiteColorAttr.id },
          },
        ],
      };

      await store.products.addProduct({
        product: data.product,
        variants: data.variants,
        images: data.images,
      });

      const dbProduct = await store.db.query.products.findFirst({
        where: { name: productName },
        with: {
          attributes: {
            columns: {
              id: true,
            },
          },
          variants: {
            with: {
              attributes: {
                columns: {
                  id: true,
                },
              },
              images: {
                with: {
                  attributes: {
                    columns: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      expect(dbProduct).toBeDefined();

      expect(dbProduct).toMatchObject({
        name: data.product.name,
        active: data.product.active,
        description: data.product.description,
        barcode: data.product.barcode,
      });
      expect(dbProduct!.attributes.map((el) => el.id)).toStrictEqual(
        Object.values(data.product.attributes),
      );

      expect(dbProduct!.variants).toBeArrayOfSize(2);

      const blackVariant = dbProduct!.variants.find((v) =>
        v.attributes.map((el) => el.id).includes(blackColorAttr.id),
      );
      expect(blackVariant).toBeDefined();
      expect(blackVariant).toMatchObject({
        price: 1100,
        quantity: 12,
        discount: 0,
      });
      expect(
        blackVariant!.images.every((img) =>
          img.attributes.map((el) => el.id).includes(blackColorAttr.id),
        ),
      );

      const whiteVariant = dbProduct!.variants.find((v) =>
        v.attributes.map((el) => el.id).includes(whiteColorAttr.id),
      );
      expect(whiteVariant).toBeDefined();
      expect(whiteVariant).toMatchObject({
        price: 1200,
        quantity: 10,
        discount: 0,
      });
      expect(
        whiteVariant!.images.every((img) =>
          img.attributes.map((el) => el.id).includes(whiteColorAttr.id),
        ),
      );
    });
  });

  describe("Given invalid input", () => {
    test("Duplicate barcode throws", async () => {
      const barcode = faker.string.numeric(12);

      await store.db.insert(products).values({
        description: faker.commerce.productDescription(),
        name: faker.commerce.productName(),
        active: true,
        barcode,
      });

      const variantImageAttr = await makeAttribute(
        faker.string.alpha(5),
        faker.string.alpha(7),
      );

      const result = store.products.addProduct({
        product: {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          active: true,
          barcode,
          attributes: {
            [faker.string.alpha(5)]: (
              await makeAttribute(faker.string.alpha(5), faker.string.alpha(7))
            ).id,
          },
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: { [variantImageAttr.key]: variantImageAttr.id },
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: { [variantImageAttr.key]: variantImageAttr.id },
          },
        ],
      });

      expect(result).rejects.toMatchObject({
        code: ProductErrorCodes.BarcodeAlreadyExists,
      });
    });

    test("Product attribute that does not exist throws", async () => {
      const variantImageAttr = await makeAttribute(
        faker.string.alpha(5),
        faker.string.alpha(7),
      );

      const result = store.products.addProduct({
        product: {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          active: true,
          barcode: faker.string.numeric(12),
          attributes: { [faker.string.alpha(5)]: faker.string.uuid() },
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: { [variantImageAttr.key]: variantImageAttr.id },
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: { [variantImageAttr.key]: variantImageAttr.id },
          },
        ],
      });

      expect(result).rejects.toMatchObject({
        code: AttributeErrorCodes.AttributeNotFound,
      });
    });

    test("Variant attribute that does not exist throws", async () => {
      const imageAttr = await makeAttribute(
        faker.string.alpha(5),
        faker.string.alpha(7),
      );

      const productAttr = await makeAttribute(
        faker.string.alpha(5),
        faker.string.alpha(7),
      );

      const varinatAttr = faker.string.uuid();

      const result = store.products.addProduct({
        product: {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          active: true,
          barcode: faker.string.numeric(12),
          attributes: { [productAttr.key]: productAttr.id },
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: { [faker.string.alpha(5)]: varinatAttr },
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: { [faker.string.alpha(5)]: varinatAttr },
          },
        ],
      });

      expect(result).rejects.toMatchObject({
        code: AttributeErrorCodes.AttributeNotFound,
      });
    });

    test("Variant without an image throws", async () => {
      const [attr1, attr2, attr3] = [
        await makeAttribute(faker.string.alpha(5), faker.string.alpha(7)),
        await makeAttribute(faker.string.alpha(5), faker.string.alpha(7)),
        await makeAttribute(faker.string.alpha(5), faker.string.alpha(7)),
      ];

      const result = store.products.addProduct({
        product: {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          active: true,
          barcode: faker.string.numeric(12),
          attributes: { [attr1.key]: attr1.id },
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: { [attr2.key]: attr2.id },
          },
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: { [attr3.key]: attr3.id },
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: { [attr2.key]: attr2.id },
          },
        ],
      });

      expect(result).rejects.toEqual(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "too_small",
            }),
          ]),
        }),
      );
    });

    test("Image without a variant throws", async () => {
      const [attr1, attr2] = [
        await makeAttribute(faker.string.alpha(5), faker.string.alpha(7)),
        await makeAttribute(faker.string.alpha(5), faker.string.alpha(7)),
      ];

      const result = store.products.addProduct({
        product: {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          active: true,
          barcode: faker.string.numeric(12),
          attributes: { [attr1.key]: attr1.id },
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: { [attr2.key]: attr2.id },
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: { [attr2.key]: attr2.id },
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: { [faker.string.alpha(5)]: faker.string.uuid() },
          },
        ],
      });

      expect(result).rejects.toEqual(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "custom",
            }),
          ]),
        }),
      );
    });
  });
});

describe("store.products.updateProduct", () => {
  describe("Given valid input", () => {
    test("Correct base product fields updates", async () => {
      const productId = crypto.randomUUID();
      const electronicAttr = await makeAttribute("category", "electronics");
      const clothingAttr = await makeAttribute("category", "clothing");

      const oldProduct = await makeProduct(
        {
          id: productId,
          name: faker.commerce.productName(),
          barcode: faker.string.numeric(12),
          description: faker.commerce.productDescription(),
          active: true,
        },
        { [clothingAttr.key]: clothingAttr.id },
      );

      const newFields: typeof products.$inferInsert = {
        name: faker.commerce.productName(),
        barcode: faker.string.numeric(12),
        description: faker.commerce.productDescription(),
        active: false,
      };

      await store.products.updateProduct({
        product: {
          id: productId,
          version: oldProduct.version,
          ...newFields,
          attributes: {
            [electronicAttr.key]: electronicAttr.id,
          },
        },
      });

      const updatedProduct = await store.db.query.products.findFirst({
        where: { id: productId },
        with: {
          attributes: {
            columns: { id: true },
          },
        },
      });

      expect(updatedProduct).toBeDefined();
      expect(updatedProduct).toMatchObject(newFields);
      expect(updatedProduct!.attributes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: electronicAttr.id,
          }),
        ]),
      );
    });

    test("Correct product variants and images fields updates", async () => {
      const attr1 = await makeAttribute(
        faker.string.alpha(5),
        faker.string.alpha(7),
      );

      const whiteColorAttr = await makeAttribute("color", faker.string.alpha(7));
      const blueColorAttr = await makeAttribute("color", faker.string.alpha(7));
      const purpleColorAttr = await makeAttribute(
        "color",
        faker.string.alpha(7),
      );
      const blackColorAttr = await makeAttribute("color", faker.string.alpha(7));
      const ram12Attr = await makeAttribute("ram", faker.string.alpha(7));
      const ram16Attr = await makeAttribute("ram", faker.string.alpha(7));

      const productId = crypto.randomUUID();

      const oldProduct = await makeProduct(
        {
          id: productId,
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          barcode: faker.string.numeric(12),
          active: true,
        },
        {
          [attr1.key]: attr1.id,
        },
      );

      // change its fields
      const oldVariant1 = await makeVariant(
        {
          productId,
          price: faker.number.float({ min: 0.1, fractionDigits: 2 }),
          quantity: faker.number.int({ min: 1 }),
        },
        {
          [whiteColorAttr.key]: whiteColorAttr.id,
        },
      );
      // change its attributes
      const oldVariant2 = await makeVariant(
        {
          productId,
          price: faker.number.float({ min: 0.1, fractionDigits: 2 }),
          quantity: faker.number.int({ min: 1 }),
        },
        {
          [blueColorAttr.key]: blueColorAttr.id,
          [ram12Attr.key]: ram12Attr.id,
        },
      );
      // change its image
      const oldVariant3 = await makeVariant(
        {
          productId,
          price: faker.number.float({ min: 0.1, fractionDigits: 2 }),
          quantity: faker.number.int({ min: 1 }),
        },
        {
          [blackColorAttr.key]: blackColorAttr.id,
        },
      );

      const whiteImage1 = await makeImage(
        { path: "S26-ultra-white-1.webp" },
        { [whiteColorAttr.key]: whiteColorAttr.id },
      );
      const whiteImage2 = await makeImage(
        { path: "S26-ultra-white-2.webp" },
        { [whiteColorAttr.key]: whiteColorAttr.id },
      );

      const blueImage1 = await makeImage(
        { path: "S26-ultra-blue-1.webp" },
        { [blueColorAttr.key]: blueColorAttr.id },
      );
      const blueImage2 = await makeImage(
        { path: "S26-ultra-blue-2.webp" },
        { [blueColorAttr.key]: blueColorAttr.id },
      );

      const blackImage1 = await makeImage(
        { path: "S26-ultra-black-1.webp" },
        { [blackColorAttr.key]: blackColorAttr.id },
      );

      await makeImageVariantLinks([
        { imageId: whiteImage1.id, productVariantId: oldVariant1.id },
        { imageId: whiteImage2.id, productVariantId: oldVariant1.id },
        { imageId: blueImage1.id, productVariantId: oldVariant2.id },
        { imageId: blueImage2.id, productVariantId: oldVariant2.id },
        { imageId: blackImage1.id, productVariantId: oldVariant3.id },
      ]);

      const updatePayload: z.infer<typeof updateProductSchema> = {
        product: { id: productId, version: oldProduct.version },
        variants: [
          {
            id: oldVariant1.id,
            discount: faker.number.int({ min: 0, max: 90 }),
            price: faker.number.float({ min: 0.1, fractionDigits: 2 }),
          },
          {
            id: oldVariant2.id,
            attributes: {
              [ram16Attr.key]: ram16Attr.id,
            },
          },
          {
            price: faker.number.float({ min: 0.1, fractionDigits: 2 }),
            quantity: faker.number.int({ min: 1 }),
            attributes: {
              [purpleColorAttr.key]: purpleColorAttr.id,
            },
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "S26-ultra-black-2.webp"),
            ),
            attributes: { [blackColorAttr.key]: blackColorAttr.id },
          },
          {
            file: await getFile(
              join(import.meta.dirname, "S26-ultra-purple-1.webp"),
            ),
            attributes: { [purpleColorAttr.key]: purpleColorAttr.id },
          },
          {
            file: await getFile(
              join(import.meta.dirname, "S26-ultra-purple-2.webp"),
            ),
            attributes: { [purpleColorAttr.key]: purpleColorAttr.id },
          },
        ],
        imagesToDelete: [blackImage1.id],
      };

      await store.products.updateProduct(updatePayload);

      const updatedProduct = await store.db.query.products.findFirst({
        where: { id: productId },
        with: {
          attributes: true,
          variants: {
            with: {
              attributes: true,
              images: {
                with: {
                  attributes: true,
                },
              },
            },
          },
        },
      });

      expect(updatedProduct).toBeDefined();

      expect(
        updatedProduct!.variants.find(
          (el) => el.id === updatePayload.variants![0]!.id,
        ),
      ).toEqual(expect.objectContaining(updatePayload.variants![0]!));

      expect(
        updatedProduct!.variants
          .find((el) => el.id === updatePayload.variants![1]!.id)
          ?.attributes.some(
            (el) => el.key === ram16Attr.key && el.id === ram16Attr.id,
          ),
      ).toBeTrue();

      expect(
        updatedProduct!.variants.find((el) =>
          el.attributes.some((a) => a.id === purpleColorAttr.id),
        ),
      ).toBeDefined();

      expect(
        updatedProduct!.variants.find((el) =>
          el.attributes.some((a) => a.id === purpleColorAttr.id),
        )?.images,
      ).toBeArrayOfSize(2);

      expect(
        updatedProduct!.variants.find((el) =>
          el.attributes.some((a) => a.id === blackColorAttr.id),
        )?.images,
      ).toBeArrayOfSize(1);
    });
  });
});

afterAll(async () => {
  await store.db.delete(attributes);
  await store.db.delete(products);
  await store.db.delete(images);
  await Bun.$`rm -f ${store.dataPath}/images/products/*`.quiet().nothrow();
});
