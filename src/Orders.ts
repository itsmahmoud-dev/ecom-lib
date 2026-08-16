import { eq, inArray, sql, SQL } from "drizzle-orm";
import { orderItems } from "./db/schema";
import { orders, productVariants } from "./db/schema";
import { handleError, OperationalError, OrderErrorCodes } from "./utils/errors";
import { Store } from "./Store";
import type z from "zod";
import {
  placeOrderParamsSchema,
  updateOrderStatusParamsSchema,
} from "./types/orders.types";

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

  async placeOrder(params: z.infer<typeof placeOrderParamsSchema>) {
    try {
      const { userId, addressId } = placeOrderParamsSchema.parse(params);
      const orderId = crypto.randomUUID();

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

      await this.store.db.transaction(async (tx) => {
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

        await tx.insert(orders).values({ id: orderId, userId, addressId });

        await tx.insert(orderItems).values(
          cartItems.map((el) => ({
            orderId,
            productId: el.productId,
            variantId: el.variantId,
            price: el.variant.price,
            quantity: el.quantity,
          })),
        );
      });

      return orderId;
    } catch (e) {
      handleError(e);
    }
  }

  async updateOrderStatus(
    params: z.infer<typeof updateOrderStatusParamsSchema>,
  ) {
    try {
      const { id, status } = updateOrderStatusParamsSchema.parse(params);

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

      await this.store.db.transaction(async (tx) => {
        await tx.update(orders).set({ status }).where(eq(orders.id, id));

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
      });
    } catch (e) {
      handleError(e);
    }
  }
}
