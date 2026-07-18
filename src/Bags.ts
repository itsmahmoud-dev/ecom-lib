import { cartItems } from "./db/schema";
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
    return await this.store.db
      .insert(cartItems)
      .values({ productId, userId, variantId })
      .returning();
  }
}
