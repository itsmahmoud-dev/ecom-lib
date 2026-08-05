import { afterAll, describe, expect, test } from "bun:test";
import { join } from "path";
import { faker } from "@faker-js/faker";
import { store } from ".";
import { attributes, images, products } from "../src/db/schema";
import { AttributeErrorCodes, ProductErrorCodes } from "../src/lib/errors";

async function makeAttribute(key: string, value: string) {
  return await store.attributes.addAttribute({ key, value });
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

afterAll(async () => {
  await store.db.delete(attributes);
  await store.db.delete(products);
  await store.db.delete(images);
  await Bun.$`rm -f ${store.dataPath}/images/products/*`.quiet().nothrow();
});
