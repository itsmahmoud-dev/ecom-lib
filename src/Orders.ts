import { eq } from "drizzle-orm";
import { orderItems } from "./db/schema";
import { orders } from "./db/schema/order.model";
import {
  handleError,
  OperationalError,
  OrderErrorCodes,
  UserErrorCodes,
} from "./lib/errors";
import { Store } from "./Store";

export class Order {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async getOrderByUser(
    userId: string,
    filters: {
      status?: (typeof orders.status.enumValues)[number];
    },
  ) {
    return await this.store.db.query.orders.findMany({
      where: { status: filters.status, userId },
    });
  }

  async placeOrder(userId: string, addressId: string) {
    try {
      let order: typeof orders.$inferSelect | undefined;
      let items;

      const user = await this.store.db.query.users.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new OperationalError({
          code: UserErrorCodes.UserNotFound,
          severity: "warning",
          logMessage: "Placing an order failed because the user does not exist",
          userMessage: "User was not found",
          key: "id",
          value: userId,
        });
      }

      const cartItems = await this.store.db.query.cartItems.findMany({
        where: { userId },
        with: {
          variant: true,
        },
      });

      if (!cartItems.length) {
        throw new OperationalError({
          code: OrderErrorCodes.CartEmpty,
          logMessage: "Placing an order failed becuase the user's cart is empty",
          userMessage: "Your cart is empty",
          severity: "warning",
        });
      }

      const productsVarinats =
        await this.store.db.query.productVariants.findMany({
          where: { id: { in: cartItems.map((el) => el.variantId) } },
          with: { product: { columns: { name: true } } },
        });

      // make sure the quantities are enough
      for (const item of cartItems) {
        const variant = productsVarinats.find((el) => el.id === item.variantId);

        if (item.quantity > variant!.quantity) {
          throw new OperationalError({
            code: OrderErrorCodes.QuantityNotEnough,
            severity: "info",
            logMessage:
              "Placing an order failed because one of the items' quantity was more than the available stock",
            userMessage: `Quantity limits apply to ${variant?.product.name}. You may purchase up to ${variant?.quantity} of this product`,
            key: ["id", "quantity"],
            value: [item.variantId, item.quantity.toString()],
          });
        }
      }

      await this.store.db.transaction(async (tx) => {
        [order] = await tx
          .insert(orders)
          .values({ userId, addressId })
          .returning();

        if (!order) {
          throw new Error("Error inserting an order");
        }

        items = await tx
          .insert(orderItems)
          .values(
            cartItems.map((el) => ({
              orderId: order!.id,
              productId: el.productId,
              price: el.variant!.price,
              variantId: el.variantId,
              quantity: el.quantity,
            })),
          )
          .returning();

        if (items.length !== cartItems.length) {
          throw new Error("Error inserting cart items");
        }
      });

      return {
        ...order,
        items,
      };
    } catch (e) {
      handleError(e);
    }
  }

  async updateOrderStatus(
    id: string,
    status: (typeof orders.status.enumValues)[number],
  ) {
    try {
      const order = await this.store.db.query.orders.findFirst({
        where: { id },
      });

      if (!order) {
        throw new OperationalError({
          code: OrderErrorCodes.OrderNotFound,
          severity: "warning",
          logMessage:
            "Chaning an order's status failed becuase the order does not exist",
          userMessage: "Order was not found",
          key: "id",
          value: id,
        });
      }

      if (status === "canceled" && order?.status !== "pending") {
        throw new OperationalError({
          code: OrderErrorCodes.InvalidOrderStatus,
          severity: "warning",
          logMessage:
            "Changing an order's status failed becuase the order is not in the pending state. Please contact support.",
          userMessage: "Order can't be cancelled at this stage",
          key: "id",
          value: id,
        });
      }

      const [updatedOrder] = await this.store.db
        .update(orders)
        .set({ status })
        .where(eq(orders.id, id))
        .returning();

      return updatedOrder;
    } catch (e) {
      handleError(e);
    }
  }
}
