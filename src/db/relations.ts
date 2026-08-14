import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    // one user can have many addresses
    addresses: r.many.addresses(),
    cartItems: r.many.cartItems({
      from: r.users.id,
      to: r.cartItems.userId,
    }),
  },
  addresses: {
    // one address can only belong to one user
    user: r.one.users({
      from: r.addresses.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  products: {
    // one product has many variants
    variants: r.many.productVariants({
      from: r.products.id,
      to: r.productVariants.productId,
    }),
    // one product has many attributes
    attributes: r.many.attributes({
      from: r.products.id.through(r.productsToAttributes.productId),
      to: r.attributes.id.through(r.productsToAttributes.attributeId),
    }),
    inCarts: r.many.cartItems({
      from: r.products.id,
      to: r.cartItems.productId,
    }),
  },
  productVariants: {
    // one variant belongs to one product
    product: r.one.products({
      from: r.productVariants.productId,
      to: r.products.id,
      optional: false,
    }),
    // one variant has many attributes
    attributes: r.many.attributes({
      from: r.productVariants.id.through(
        r.productVariantsToAttributes.productVariantId,
      ),
      to: r.attributes.id.through(r.productVariantsToAttributes.attributeId),
    }),
    // one variant can have many images
    images: r.many.images({
      from: r.productVariants.id.through(
        r.productVariantsToImages.productVariantId,
      ),
      to: r.images.id.through(r.productVariantsToImages.imageId),
    }),
    inCarts: r.many.cartItems({
      from: r.productVariants.id,
      to: r.cartItems.variantId,
    }),
  },
  attributes: {
    // an attribute can belong to one parent attribute (e.g. "size" -> "category: clothing")
    parent: r.one.attributes({
      from: r.attributes.parentId,
      to: r.attributes.id,
      optional: true,
    }),
    // an attribute can have many child attributes
    children: r.many.attributes({
      from: r.attributes.id,
      to: r.attributes.parentId,
    }),
  },
  images: {
    // one image can belong to many variants
    productVariants: r.many.productVariants({
      from: r.images.id.through(r.productVariantsToImages.imageId),
      to: r.productVariants.id.through(
        r.productVariantsToImages.productVariantId,
      ),
    }),
    // one image can have many attributes
    attributes: r.many.attributes({
      from: r.images.id.through(r.imagesToAttributes.imageId),
      to: r.attributes.id.through(r.imagesToAttributes.attributeId),
    }),
  },
  cartItems: {
    // one cart item can have one product
    product: r.one.products({
      from: r.cartItems.productId,
      to: r.products.id,
      optional: false,
    }),
    // one cart item can have one variant
    variant: r.one.productVariants({
      from: r.cartItems.variantId,
      to: r.productVariants.id,
      optional: false,
    }),
    // one cart item can have one user
    user: r.one.users({
      from: r.cartItems.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  collections: {
    products: r.many.products({
      from: r.collections.id.through(r.inCollection.collectionId),
      to: r.products.id.through(r.inCollection.productId),
    }),
  },
  orders: {
    // one order can have multiple items
    items: r.many.orderItems({
      from: r.orders.id,
      to: r.orderItems.id,
    }),
  },
}));
