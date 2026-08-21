import { eq, inArray, sql, SQL } from "drizzle-orm";
import { orderItems } from "./db/schema";
import { orders, productVariants } from "./db/schema";
import {
  CustomError,
  CustomErrorCodes,
  handleError,
  NotFoundError,
  QuantityInsufficientError,
} from "./utils/errors";
import { Store } from "./Store";
import {
  placeOrderParamsSchema,
  updateOrderStatusParamsSchema,
} from "./types/orders.types";
import {
  insertManyOrThrow,
  insertOneOrThrow,
  mutateManyOrThrow,
  mutateOneOrThrow,
} from "./utils/dbHelpers";
import type z from "zod";

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

      if (!cartItems.length) throw new CustomError(CustomErrorCodes.EmptyCart);

      const order = await this.store.db.transaction(async (tx) => {
        const variantQuantityUpdateSQLChunks: SQL[] = [];
        const variantQuantityUpdateIds: string[] = [];

        // make sure the quantities are enough
        for (const item of cartItems) {
          if (item.quantity > item.variant.quantity)
            throw new QuantityInsufficientError(
              "order",
              item.quantity,
              item.variant.quantity,
            );

          variantQuantityUpdateSQLChunks.push(
            sql`WHEN ${productVariants.id} = ${item.variant.id} THEN ${productVariants.quantity} - ${item.quantity}`,
          );
          variantQuantityUpdateIds.push(item.variant.id);
        }

        await mutateManyOrThrow(
          tx
            .update(productVariants)
            .set({
              quantity: sql`(CASE ${sql.join(variantQuantityUpdateSQLChunks, sql` `)} ELSE ${productVariants.quantity} END)`,
            })
            .where(inArray(productVariants.id, variantQuantityUpdateIds)),
          "product variant",
        );

        const order = await insertOneOrThrow(
          tx
            .insert(orders)
            .values({ id: orderId, userId, addressId })
            .returning(),
          "order",
        );

        const items = await insertManyOrThrow(
          tx
            .insert(orderItems)
            .values(
              cartItems.map((el) => ({
                orderId,
                productId: el.productId,
                variantId: el.variantId,
                price: el.variant.price,
                quantity: el.quantity,
              })),
            )
            .returning(),
          "order items",
        );

        return { ...order, items };
      });

      return order;
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

      if (!order) throw new NotFoundError("order", `id: ${id}`);

      if (order.status === "canceled")
        throw new CustomError(CustomErrorCodes.OrderAlreadyCanceled);

      if (status === "canceled" && order.status !== "pending")
        throw new CustomError(CustomErrorCodes.OrderCannotBeCanceled);

      await this.store.db.transaction(async (tx) => {
        await mutateOneOrThrow(
          tx.update(orders).set({ status }).where(eq(orders.id, id)),
          "order",
          `id:${id}`,
        );

        if (status === "canceled") {
          const variantQuantityUpdateSQLChunks: SQL[] = [];
          const variantQuantityUpdateSQLConditions: string[] = [];

          for (const item of order.items) {
            variantQuantityUpdateSQLChunks.push(
              sql`WHEN ${productVariants.id} = ${item.variantId} THEN ${productVariants.quantity} + ${item.quantity}`,
            );
            variantQuantityUpdateSQLConditions.push(item.variantId);
          }

          await mutateManyOrThrow(
            tx
              .update(productVariants)
              .set({
                quantity: sql`(CASE ${sql.join(variantQuantityUpdateSQLChunks, sql` `)} ELSE ${productVariants.quantity} END)`,
              })
              .where(
                inArray(productVariants.id, variantQuantityUpdateSQLConditions),
              ),
            "product variant",
          );
        }
      });
    } catch (e) {
      handleError(e);
    }
  }
}
