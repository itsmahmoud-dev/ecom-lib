import { eq, sql } from "drizzle-orm";
import { cartItems } from "./db/schema";
import {
  CartItemErrorsCodes,
  handleError,
  OperationalError,
} from "./lib/errors";

import type { Store } from "./Store";

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

  async addCartItem(userId: string, productId: string, variantId: string) {
    try {
      const item = await this.store.db
        .insert(cartItems)
        .values({ productId, userId, variantId })
        .returning();

      if (!item) {
        throw new OperationalError({
          code: "",
          severity: "error",
          logMessage: "Error inserting a cart item",
          userMessage: "Something went wrong",
        });
      }

      return item;
    } catch (e) {
      handleError(e);
    }
  }

  async removeItem(id: string) {
    const [item] = await this.store.db
      .delete(cartItems)
      .where(eq(cartItems.id, id))
      .returning();

    if (!item) {
      throw new OperationalError({
        code: CartItemErrorsCodes.CartItemNotFound,
        severity: "warning",
        userMessage: "Bag item was not found",
        logMessage: `Removing cart item failed because it does not exist`,
        key: "id",
        value: id,
      });
    }

    return item.id;
  }

  async incrementQuantity(id: string) {
    const [item] = await this.store.db
      .update(cartItems)
      .set({ quantity: sql`${cartItems.quantity} + 1` })
      .where(eq(cartItems.id, id))
      .returning();

    if (!item) {
      throw new OperationalError({
        code: CartItemErrorsCodes.CartItemNotFound,
        severity: "warning",
        userMessage: "Bag item was not found",
        logMessage: `Incrementing cart item quantity failed because it does not exist`,
        key: "id",
        value: id,
      });
    }

    return item;
  }

  async decrementQuantity(id: string) {
    try {
      const [item] = await this.store.db
        .update(cartItems)
        .set({ quantity: sql`${cartItems.quantity} - 1` })
        .where(eq(cartItems.id, id))
        .returning();

      if (!item) {
        throw new OperationalError({
          code: CartItemErrorsCodes.CartItemNotFound,
          severity: "warning",
          userMessage: "Bag item was not found",
          logMessage: `Decrementing cart item quantity failed because it does not exist`,
          key: "id",
          value: id,
        });
      }

      return item;
    } catch (e) {
      handleError(e);
    }
  }

  async updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) {
      throw new OperationalError({
        code: CartItemErrorsCodes.QuantityInvalid,
        severity: "info",
        userMessage: "Quantity should be a positive number",
        logMessage: `Updating cart item quantity failed because the quantity is not positive`,
        key: "id",
        value: id,
      });
    }

    const [item] = await this.store.db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();

    if (!item) {
      throw new OperationalError({
        code: CartItemErrorsCodes.CartItemNotFound,
        severity: "warning",
        userMessage: "Bag item was not found",
        logMessage: `Updating cart item quantity failed because it does not exist`,
        key: "id",
        value: id,
      });
    }

    return item;
  }

  async clearItems(userId: string) {
    await this.store.db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  async importItems(
    userId: string,
    items: { productId: string; variantId: string; quantity: number }[],
  ) {
    try {
      const newItems = await this.store.db
        .insert(cartItems)
        .values(
          items.map((el) => ({
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
