import z from "zod";
import { orders } from "../db/schema";

export const placeOrderParamsSchema = z.strictObject({
  userId: z.uuid(),
  addressId: z.uuid(),
});

export const updateOrderStatusParamsSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(orders.status.enumValues),
});
