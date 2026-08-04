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
      const productName = faker.commerce.productName();

      const data = {
        product: {
          name: productName,
          active: true,
          description: faker.commerce.productDescription(),
          barcode: faker.string.numeric(12),
          attributes: [(await makeAttribute("category", "tech")).id],
        },
        variants: [
          {
            price: 1100,
            quantity: 12,
            discount: 0,
            attributes: [
              (await makeAttribute("storage", "128")).id,
              (await makeAttribute("ram", "6")).id,
              blackColorAttr.id,
            ],
          },
          {
            price: 1200,
            quantity: 10,
            discount: 0,
            attributes: [
              (await makeAttribute("storage", "256")).id,
              (await makeAttribute("ram", "8")).id,
              whiteColorAttr.id,
            ],
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: [blackColorAttr.id],
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-2.webp"),
            ),
            attributes: [blackColorAttr.id],
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-white-1.webp"),
            ),
            attributes: [whiteColorAttr.id],
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-white-2.webp"),
            ),
            attributes: [whiteColorAttr.id],
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
        data.product.attributes,
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
          attributes: [
            (await makeAttribute(faker.string.alpha(5), faker.string.alpha(7)))
              .id,
          ],
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: [variantImageAttr.id],
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: [variantImageAttr.id],
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
          attributes: [faker.string.uuid()],
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: [variantImageAttr.id],
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: [variantImageAttr.id],
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
          attributes: [productAttr.id],
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: [varinatAttr],
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: [varinatAttr],
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
          attributes: [attr1.id],
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: [attr2.id],
          },
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: [attr3.id],
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: [attr2.id],
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

    // validate every image has at least one variant
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
          attributes: [attr1.id],
        },
        variants: [
          {
            price: 1000,
            quantity: 10,
            discount: 0,
            attributes: [attr2.id],
          },
        ],
        images: [
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: [attr2.id],
          },
          {
            file: await getFile(
              join(import.meta.dirname, "./S26-ultra-black-1.webp"),
            ),
            attributes: [faker.string.uuid()],
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
