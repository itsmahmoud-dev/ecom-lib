import { eq, sql } from "drizzle-orm";
import { cartItems } from "./db/schema";
import {
  CartItemErrorsCodes,
  handleError,
  OperationalError,
} from "./lib/errors";

import type { Store } from "./Store";
import type z from "zod";
import {
  addCartItemSchema,
  cartItemQuantityschema,
  importCartItemsSchema,
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

  async addCartItem(params: z.infer<typeof addCartItemSchema>) {
    try {
      const data = addCartItemSchema.parse({ ...params });

      const item = await this.store.db
        .insert(cartItems)
        .values({ ...data })
        .returning();

      if (!item) {
        throw new Error("Error inserting a cart item");
      }

      return item;
    } catch (e) {
      handleError(e);
    }
  }

  async removeItem(id: string) {
    try {
      const [item] = await this.store.db
        .delete(cartItems)
        .where(eq(cartItems.id, id))
        .returning();

      if (!item) {
        throw new OperationalError({
          code: CartItemErrorsCodes.CartItemNotFound,
          message: `Removing cart item failed because it does not exist`,
        });
      }

      return item;
    } catch (e) {
      handleError(e);
    }
  }

  async updateQuantity(
    id: string,
    quantity: z.infer<typeof cartItemQuantityschema>,
  ) {
    try {
      const data = cartItemQuantityschema.parse(quantity);

      const item = await this.store.db.transaction(async (tx) => {
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

        if (data > cartItem.variant.quantity) {
          throw new OperationalError({
            code: CartItemErrorsCodes.CartItemNotFound,
            message: `Updating cart item quantity failed because the quantity was more than the stock`,
          });
        }

        const [updatedItem] = await tx
          .update(cartItems)
          .set({ quantity: data })
          .where(eq(cartItems.id, id))
          .returning();

        return updatedItem;
      });

      return item;
    } catch (e) {
      handleError(e);
    }
  }

  async importItems(
    userId: z.infer<typeof userIdSchema>,
    items: z.infer<typeof importCartItemsSchema>,
  ) {
    try {
      const data = importCartItemsSchema.parse(items);

      const newItems = await this.store.db
        .insert(cartItems)
        .values(
          data.map((el) => ({
            userId,
            productId: el.productId,
            quantity: el.quantity,
            variantId: el.variantId,
          })),
        )
        .returning();

      return newItems;
    } catch (e) {
      handleError(e);
    }
  }
}
