import { eq } from "drizzle-orm";
import { cartItems } from "./db/schema";
import {
  handleError,
  NotFoundError,
  QuantityInsufficientError,
} from "./utils/errors";
import {
  insertManyOrThrow,
  insertOneOrThrow,
  mutateOneOrThrow,
} from "./utils/dbHelpers";
import {
  addCartItemParamsSchema,
  updateCartItemQuantityParamsSchema,
  importCartItemsParamsSchema,
  removeCartItemParamSchema,
  userIdSchema,
} from "./types/cartItems.type";
import type { Store } from "./Store";
import type z from "zod";

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

      const item = await insertOneOrThrow(
        this.store.db
          .insert(cartItems)
          .values({ id: itemId, ...data })
          .returning(),
        "cart item",
      );

      return item;
    } catch (e) {
      handleError(e);
    }
  }

  async removeItem(id: z.infer<typeof removeCartItemParamSchema>) {
    try {
      const validatedId = removeCartItemParamSchema.parse(id);

      await mutateOneOrThrow(
        this.store.db
          .delete(cartItems)
          .where(eq(cartItems.id, validatedId))
          .returning(),
        "cart item",
      );
    } catch (e) {
      handleError(e);
    }
  }

  async updateQuantity(
    params: z.infer<typeof updateCartItemQuantityParamsSchema>,
  ) {
    try {
      const { id, quantity } = updateCartItemQuantityParamsSchema.parse(params);

      const item = await this.store.db.transaction(async (tx) => {
        const cartItem = await tx.query.cartItems.findFirst({
          where: { id },
          with: { variant: true },
        });

        if (!cartItem) throw new NotFoundError("cart item", `id: ${id}`);

        if (quantity > cartItem.variant.quantity)
          throw new QuantityInsufficientError(
            "cart item",
            quantity,
            cartItem.variant.quantity,
          );

        const item = await mutateOneOrThrow(
          tx
            .update(cartItems)
            .set({ quantity })
            .where(eq(cartItems.id, id))
            .returning(),
          "cart item",
        );

        return item;
      });

      return item;
    } catch (e) {
      handleError(e);
    }
  }

  async importItems(params: z.infer<typeof importCartItemsParamsSchema>) {
    try {
      const { items, userId } = importCartItemsParamsSchema.parse(params);
      const itemsWithIds = items.map((item) => ({
        id: crypto.randomUUID(),
        userId,
        ...item,
      }));

      const newItems = await insertManyOrThrow(
        this.store.db.insert(cartItems).values(itemsWithIds).returning(),
        "cart items",
      );

      return newItems;
    } catch (e) {
      handleError(e);
    }
  }
}
