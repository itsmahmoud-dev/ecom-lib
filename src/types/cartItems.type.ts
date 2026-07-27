import z from "zod";

export const userIdSchema = z.uuid({
  error: (issue) =>
    issue.input
      ? "That doesn't look like a valid user"
      : "Something went wrong, refresh and try again",
});

export const productIdSchema = z.uuid({
  error: (issue) =>
    issue.input
      ? "That doesn't look like a valid product"
      : "Please select a product",
});

export const variantIdSchema = z.uuid({
  error: (issue) =>
    issue.input
      ? "That doesn't look like a valid variant"
      : "Please select a variant",
});

export const cartItemIdSchema = z.uuid({
  error: (issue) =>
    issue.input
      ? "That doesn't look like a valid cart item"
      : "Please select a cart item",
});

export const addCartItemSchema = z.strictObject({
  userId: userIdSchema,
  productId: productIdSchema,
  variantId: variantIdSchema,
});

export const cartItemQuantityschema = z
  .int("That doesn't look like a valid number")
  .positive("Cart item quantity should be positive");

export const importCartItemsSchema = z
  .strictObject({
    productId: productIdSchema,
    variantId: variantIdSchema,
    quantity: cartItemQuantityschema,
  })
  .array()
  .min(1, "At least one cart item is required");
