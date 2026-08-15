import z from "zod";

export const userIdSchema = z.uuid();

export const productIdSchema = z.uuid();

export const variantIdSchema = z.uuid();

export const cartItemIdSchema = z.uuid();

export const addCartItemParamsSchema = z.strictObject({
  userId: userIdSchema,
  productId: productIdSchema,
  variantId: variantIdSchema,
});

export const updateCartItemQuantityParamsSchema = z.strictObject({
  id: cartItemIdSchema,
  quantity: z.int().positive(),
});

export const importCartItemsParamsSchema = z.strictObject({
  userId: userIdSchema,
  items: z
    .array(
      z.strictObject({
        productId: productIdSchema,
        variantId: variantIdSchema,
        quantity: updateCartItemQuantityParamsSchema.shape.quantity,
      }),
    )
    .min(1),
});

export const removeCartItemParamSchema = cartItemIdSchema;
