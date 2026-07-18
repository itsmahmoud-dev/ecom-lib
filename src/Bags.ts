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

  async addCartItem(userId: string, productId: string, variantId: string) {
    return await this.store.db
      .insert(cartItems)
      .values({ productId, userId, variantId })
      .returning();
  }
}
