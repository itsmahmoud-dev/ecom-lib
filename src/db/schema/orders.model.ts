import { pgEnum, snakeCase } from "drizzle-orm/pg-core";
import { users } from "./users.model";
import { addresses } from "./addresses.model";

export const orderStatus = pgEnum("orderStatus", [
  "pending",
  "inProgress",
  "inTransit",
  "completed",
  "canceled",
]);

export const orders = snakeCase.table("orders", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  userId: t
    .uuid()
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),

  addressId: t
    .uuid()
    .notNull()
    .references(() => addresses.id, { onDelete: "set null" }),

  status: orderStatus().notNull().default("pending"),

  createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),

  updatedAt: t
    .timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));
