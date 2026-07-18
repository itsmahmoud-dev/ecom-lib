import { cartItems } from "./db/schema";
import { handleError } from "./lib/errors";
import type { Store } from "./Store";

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
}
