import { eq } from "drizzle-orm";
import { cartItems } from "./db/schema";
import {
  CartItemErrorsCodes,
  handleError,
  OperationalError,
} from "./lib/errors";

import type { Store } from "./Store";
import type z from "zod";
import {
  addCartItemParamsSchema,
  updateCartItemQuantityParamsSchema,
  importCartItemsParamsSchema,
  removeCartItemParamSchema,
  userIdSchema,
} from "./types/cartItems.type";

export class CartItems {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async getItemsByUser(userId: string) {
    return await this.store.db.query.cartItems.findMany({ where: { userId } });
  }

  async getItemsByProduct(productId: string) {
    return await this.store.db.query.cartItems.findMany({
      where: { productId },
    });
  }

  async getItemsByVariant(variantId: string) {
    return await this.store.db.query.cartItems.findMany({
      where: { variantId },
    });
  }

  async addCartItem(params: z.infer<typeof addCartItemParamsSchema>) {
    try {
      const data = addCartItemParamsSchema.parse({ ...params });
      const itemId = crypto.randomUUID();

      await this.store.db.insert(cartItems).values({ id: itemId, ...data });

      return itemId;
    } catch (e) {
      handleError(e);
    }
  }

  async removeItem(id: z.infer<typeof removeCartItemParamSchema>) {
    try {
      const validatedId = removeCartItemParamSchema.parse(id);

      await this.store.db.delete(cartItems).where(eq(cartItems.id, validatedId));
    } catch (e) {
      handleError(e);
    }
  }

  async updateQuantity(params: {
    id: string;
    quantity: z.infer<typeof updateCartItemQuantityParamsSchema>;
  }) {
    try {
      const { id, quantity } = updateCartItemQuantityParamsSchema.parse(params);

      await this.store.db.transaction(async (tx) => {
        const cartItem = await tx.query.cartItems.findFirst({
          where: { id },
          with: { variant: true },
        });

        if (!cartItem) {
          throw new OperationalError({
            code: CartItemErrorsCodes.CartItemNotFound,
            message: `Updating cart item quantity failed because it does not exist`,
          });
        }

        if (quantity > cartItem.variant.quantity) {
          throw new OperationalError({
            code: CartItemErrorsCodes.CartItemNotFound,
            message: `Updating cart item quantity failed because the quantity was more than the stock`,
          });
        }

        await tx.update(cartItems).set({ quantity }).where(eq(cartItems.id, id));
      });
    } catch (e) {
      handleError(e);
    }
  }

  async importItems(params: {
    userId: z.infer<typeof userIdSchema>;
    items: z.infer<typeof importCartItemsParamsSchema>;
  }) {
    try {
      const { items, userId } = importCartItemsParamsSchema.parse(params);
      const itemsWithIds = items.map((item) => ({
        id: crypto.randomUUID(),
        ...item,
      }));

      await this.store.db.insert(cartItems).values(
        itemsWithIds.map((el) => ({
          id: el.id,
          userId,
          productId: el.productId,
          quantity: el.quantity,
          variantId: el.variantId,
        })),
      );

      return itemsWithIds.map((el) => el.id);
    } catch (e) {
      handleError(e);
    }
  }
}
