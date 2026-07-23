import * as z from "zod";
import {
  addCollectionParamSchema,
  updateCollectionParamSchema,
  addRemoveProductToCollectionParamSchema,
  deleteCollectionParamSchema,
} from "./types/collections.type";
import {
  CollectionErrorCodes,
  handleError,
  OperationalError,
} from "./lib/errors";
import { collections, inCollection } from "./db/schema";
import { and, eq, inArray } from "drizzle-orm";

import type { Store } from "./Store";

export class Collections {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async addCollection(name: z.infer<typeof addCollectionParamSchema>) {
    try {
      const data = addCollectionParamSchema.parse(name);

      const [collection] = await this.store.db
        .insert(collections)
        .values({ name: data })
        .returning();

      if (!collection) {
        throw new Error("Error inserting collection");
      }

      return collection;
    } catch (e) {
      handleError(e);
    }
  }

  async updateCollection(params: z.infer<typeof updateCollectionParamSchema>) {
    try {
      const data = updateCollectionParamSchema.parse(params);

      const [collection] = await this.store.db
        .update(collections)
        .set({ name: data.name })
        .where(eq(collections.id, data.id))
        .returning();

      if (!collection) {
        throw new OperationalError({
          code: CollectionErrorCodes.CollectionNotFound,
          severity: "warning",
          userMessage: "Collection was not found",
          logMessage: "Updating collection failed because it does not exist",
          key: "id",
          value: data.id,
        });
      }

      return collection;
    } catch (e) {
      handleError(e);
    }
  }

  async addProductsToCollection(
    params: z.infer<typeof addRemoveProductToCollectionParamSchema>,
  ) {
    try {
      const data = addRemoveProductToCollectionParamSchema.parse(params);

      const result = await this.store.db
        .insert(inCollection)
        .values(
          data.productIds.map((t) => ({ collectionId: data.id, productId: t })),
        )
        .returning();

      if (result.length !== data.productIds.length) {
        throw new Error("Error adding some or all products to collection");
      }
    } catch (e) {
      handleError(e);
    }
  }

  async removeProductsFromCollection(
    params: z.infer<typeof addRemoveProductToCollectionParamSchema>,
  ) {
    try {
      const data = addRemoveProductToCollectionParamSchema.parse(params);

      const result = await this.store.db
        .delete(inCollection)
        .where(
          and(
            eq(inCollection.collectionId, data.id),
            inArray(inCollection.productId, data.productIds),
          ),
        )
        .returning();

      if (result.length !== data.productIds.length) {
        throw new Error("Error deleting some or all inCollection rows");
      }
    } catch (e) {
      handleError(e);
    }
  }

  async removeCollection(id: z.infer<typeof deleteCollectionParamSchema>) {
    try {
      const data = deleteCollectionParamSchema.parse(id);

      const [collection] = await this.store.db
        .delete(collections)
        .where(eq(collections.id, data))
        .returning();

      if (!collection) {
        throw new OperationalError({
          code: CollectionErrorCodes.CollectionNotFound,
          severity: "warning",
          userMessage: "Collection was not found",
          logMessage: "Removing collection failed because it does not exist",
          key: "id",
          value: id,
        });
      }
    } catch (e) {
      handleError(e);
    }
  }
}
