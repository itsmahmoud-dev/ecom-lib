import { relations } from "drizzle-orm";

import { users } from "./users.model";
import { addresses } from "./addresses.model";
import { productVariants } from "./productVariants.model";
import { products } from "./products.model";

// User Relations

export const UserRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
}));

// Address Relations

export const AddressRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

// Product  Relations

export const ProductRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
}));

// Product Variant Relations

export const ProductVariantRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));
