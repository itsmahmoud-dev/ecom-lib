import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    // one user can have many addresses
    addresses: r.many.addresses(),
  },
  addresses: {
    // one address can only belong to one user
    user: r.one.users({
      from: r.addresses.userId,
      to: r.users.id,
    }),
  },
  products: {
    // one product has many variants
    variants: r.many.productVariants({
      from: r.products.id,
      to: r.productVariants.productId,
    }),
    // one product has many facets
    attributes: r.many.facets({
      from: r.products.id.through(r.productsToFacets.productId),
      to: r.facets.id.through(r.productsToFacets.facetId),
    }),
  },
  productVariants: {
    // one variant belongs to one product
    product: r.one.products({
      from: r.productVariants.productId,
      to: r.products.id,
    }),
    // one variant has many facets
    attributes: r.many.facets({
      from: r.productVariants.id.through(
        r.productVariantsToFacets.productVariantId,
      ),
      to: r.facets.id.through(r.productVariantsToFacets.facetId),
    }),
    // one variant can have many images
    images: r.many.images({
      from: r.productVariants.id.through(
        r.productVariantsToImages.productVariantId,
      ),
      to: r.images.id.through(r.productVariantsToImages.imageId),
    }),
  },
  facets: {
    // a facet can belong to one parent facet (e.g. "size" -> "category: clothing")
    parent: r.one.facets({
      from: r.facets.parentId,
      to: r.facets.id,
    }),
    // a facet can have many child facets
    children: r.many.facets({
      from: r.facets.id,
      to: r.facets.parentId,
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
    // one image can have many facets
    attributes: r.many.facets({
      from: r.images.id.through(r.imagesToFacets.imageId),
      to: r.facets.id.through(r.imagesToFacets.facetId),
    }),
  },
}));
