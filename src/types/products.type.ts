import z from "zod";

export const addProductSchema = z
  .strictObject({
    product: z.strictObject({
      name: z.string(),
      barcode: z.string().nullish(),
      active: z.boolean(),
      description: z.string(),
      attributes: z
        .record(z.string(), z.string())
        .refine((data) => Object.entries(data).length > 0),
    }),
    variants: z
      .array(
        z.strictObject({
          price: z.number().positive(),
          discount: z.number().optional(),
          quantity: z.int().nonnegative(),
          attributes: z
            .record(z.string(), z.string())
            .refine((data) => Object.entries(data).length > 0),
        }),
      )
      .min(1),
    images: z
      .array(
        z.strictObject({
          file: z.file().mime(["image/png", "image/jpeg", "image/webp"]),
          attributes: z
            .record(z.string(), z.string())
            .refine((data) => Object.entries(data).length > 0),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    let imagesCount = 0;
    // making sure that each variant has at least one image
    for (const variant of data.variants) {
      const imageWithSubsetAttrsExists = data.images.filter((image) =>
        Object.values(image.attributes).every((attr) =>
          Object.values(variant.attributes).includes(attr),
        ),
      );

      if (!imageWithSubsetAttrsExists.length) {
        ctx.addIssue({
          code: "too_small",
          minimum: 1,
          origin: "array",
          path: ["images"],
          inclusive: true,
        });
      }

      imagesCount += imageWithSubsetAttrsExists.length;
    }

    if (imagesCount < data.images.length) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: "Array contains orphan items",
      });
    }
  });

export const updateProductSchema = z
  .strictObject({
    product: z.strictObject({
      id: z.uuid(),
      version: z.int(),
      name: z.string().optional(),
      barcode: z.string().nullish(),
      active: z.boolean().optional(),
      description: z.string().optional(),
      attributes: z.record(z.string(), z.string()).optional(),
    }),
    variants: z
      .array(
        z.union([
          z.strictObject({
            id: z.undefined().optional(),
            price: z.number().positive(),
            discount: z.number().optional(),
            quantity: z.int().nonnegative(),
            attributes: z
              .record(z.string(), z.string())
              .refine((data) => Object.entries(data).length > 0),
          }),
          z.strictObject({
            id: z.uuid(),
            price: z.number().positive().optional(),
            discount: z.number().optional(),
            quantity: z.int().nonnegative().optional(),
            attributes: z.record(z.string(), z.string()).optional(),
          }),
        ]),
      )
      .optional(),
    images: z
      .array(
        z.union([
          z.strictObject({
            id: z.undefined().optional(),
            file: z.file().mime(["image/png", "image/jpeg", "image/webp"]),
            attributes: z
              .record(z.string(), z.string())
              .refine((data) => Object.entries(data).length > 0),
          }),
          z.strictObject({
            id: z.uuid(),
            attributes: z
              .record(z.string(), z.string())
              .refine((data) => Object.entries(data).length > 0),
          }),
        ]),
      )
      .optional(),
    variantsToDelete: z.array(z.uuid()).optional(),
    imagesToDelete: z.array(z.uuid()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.variants
        ?.filter((el) => el.id !== undefined)
        .some((el) => data.variantsToDelete?.includes(el.id))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["variantsToDelete", "variants"],
      });
    }
    if (
      data.images
        ?.filter((el) => el.id !== undefined)
        .some((el) => data.imagesToDelete?.includes(el.id))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["imagesToDelete", "images"],
      });
    }
  });
