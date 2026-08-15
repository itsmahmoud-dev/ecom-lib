import { eq, inArray, sql, SQL } from "drizzle-orm";
import { orderItems } from "./db/schema";
import { orders, productVariants } from "./db/schema";
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

  async getOrdersByUser(
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
      const user = await this.store.db.query.users.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new OperationalError({
          code: UserErrorCodes.UserNotFound,
          message: "Placing an order failed because the user does not exist",
        });
      }

      const cartItems = await this.store.db.query.cartItems.findMany({
        where: { userId },
        with: {
          variant: {
            with: {
              product: {
                columns: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!cartItems.length) {
        throw new OperationalError({
          code: OrderErrorCodes.CartEmpty,
          message: "Placing an order failed becuase the user's cart is empty",
        });
      }

      const order = await this.store.db.transaction(async (tx) => {
        const variantQuantityUpdateSQLChunks: SQL[] = [];
        const variantQuantityUpdateIds: string[] = [];

        // make sure the quantities are enough
        for (const item of cartItems) {
          const variant = item.variant;

          if (item.quantity > variant.quantity) {
            throw new OperationalError({
              code: OrderErrorCodes.QuantityNotEnough,
              message:
                "Placing an order failed because one of the items' quantity was more than the available stock",
              //TODO: COMPLETE DATA
            });
          }

          variantQuantityUpdateSQLChunks.push(
            sql`WHEN ${productVariants.id} = ${variant.id} THEN ${productVariants.quantity} - ${item.quantity}`,
          );
          variantQuantityUpdateIds.push(variant.id);
        }

        await tx
          .update(productVariants)
          .set({
            quantity: sql`(CASE ${sql.join(variantQuantityUpdateSQLChunks, sql` `)} ELSE ${productVariants.quantity} END)`,
          })
          .where(inArray(productVariants.id, variantQuantityUpdateIds));

        const [order] = await tx
          .insert(orders)
          .values({ userId, addressId })
          .returning();

        if (!order) {
          throw new Error("Error inserting an order");
        }

        const items = await tx
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

        return { ...order, items };
      });

      return order;
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
        with: {
          items: true,
        },
      });

      if (!order) {
        throw new OperationalError({
          code: OrderErrorCodes.OrderNotFound,
          message:
            "Changing an order's status failed becuase the order does not exist",
        });
      }

      if (order.status === "canceled") {
        throw new OperationalError({
          code: OrderErrorCodes.InvalidOrderStatus,
          message:
            "Changing an order's status failed becuase the order has been canceled",
        });
      }

      if (status === "canceled" && order.status !== "pending") {
        throw new OperationalError({
          code: OrderErrorCodes.InvalidOrderStatus,
          message:
            "Canceling an order failed because it's past the pending state.",
        });
      }

      const updatedOrder = await this.store.db.transaction(async (tx) => {
        const [updatedOrder] = await tx
          .update(orders)
          .set({ status })
          .where(eq(orders.id, id))
          .returning();

        if (status === "canceled") {
          const variantQuantityUpdateSQLChunks: SQL[] = [];
          const variantQuantityUpdateSQLConditions: string[] = [];

          for (const item of order.items) {
            variantQuantityUpdateSQLChunks.push(
              sql`WHEN ${productVariants.id} = ${item.variantId} THEN ${productVariants.quantity} + ${item.quantity}`,
            );
            variantQuantityUpdateSQLConditions.push(item.variantId);
          }

          await tx
            .update(productVariants)
            .set({
              quantity: sql`(CASE ${sql.join(variantQuantityUpdateSQLChunks, sql` `)} ELSE ${productVariants.quantity} END)`,
            })
            .where(
              inArray(productVariants.id, variantQuantityUpdateSQLConditions),
            );
        }

        return updatedOrder;
      });

      return updatedOrder;
    } catch (e) {
      handleError(e);
    }
  }
}
