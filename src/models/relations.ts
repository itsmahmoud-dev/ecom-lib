import { relations } from "drizzle-orm";

import { users } from "./users.model";
import { addresses } from "./addresses.model";

export const UserRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
}));

export const AddressRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));
