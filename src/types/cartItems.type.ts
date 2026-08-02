import z from "zod";

export const userIdSchema = z.uuid();

export const productIdSchema = z.uuid();

export const variantIdSchema = z.uuid();

export const cartItemIdSchema = z.uuid();

export const addCartItemSchema = z.strictObject({
  userId: userIdSchema,
  productId: productIdSchema,
  variantId: variantIdSchema,
});

export const cartItemQuantityschema = z.int().positive();

export const importCartItemsSchema = z
  .strictObject({
    productId: productIdSchema,
    variantId: variantIdSchema,
    quantity: cartItemQuantityschema,
  })
  .array()
  .min(1);
