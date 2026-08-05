import z from "zod";

export const addProductSchema = z
  .strictObject({
    product: z.strictObject({
      name: z.string(),
      barcode: z.string().nullish(),
      active: z.boolean(),
      description: z.string(),
      attributes: z.record(z.string(), z.string()),
    }),
    variants: z
      .array(
        z.strictObject({
          price: z.number().positive(),
          discount: z.number().optional(),
          quantity: z.int().nonnegative(),
          attributes: z.record(z.string(), z.string()),
        }),
      )
      .min(1),
    images: z
      .array(
        z.strictObject({
          file: z.file().mime(["image/png", "image/jpeg", "image/webp"]),
          attributes: z.record(z.string(), z.string()),
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
