import { eq, sql } from "drizzle-orm";
import { cartItems } from "./db/schema";
import { BagItemsError, handleError } from "./lib/errors";
import type { Store } from "./Store";
import { OperError } from "./lib/OperError";

export class Bags {
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
        throw new Error("Error inserting cart item");
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
      throw new OperError({
        code: BagItemsError.BagItemNotFound,
        message: "Bag item was not found",
      });
    }

    return item.id;
  }

  async incrementQuantity(id: string) {
    const item = await this.store.db
      .update(cartItems)
      .set({ quantity: sql`${cartItems.quantity} + 1` })
      .where(eq(cartItems.id, id))
      .returning();

    if (!item) {
      throw new OperError({
        code: BagItemsError.BagItemNotFound,
        message: "Bag item was not found",
      });
    }

    return item;
  }
}
