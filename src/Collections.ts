import * as z from "zod";
import {
  addCollectionParamSchema,
  updateCollectionParamsSchema,
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

  async addCollection(params: z.infer<typeof addCollectionParamSchema>) {
    try {
      const { name, productIds } = addCollectionParamSchema.parse(params);
      const collectionId = crypto.randomUUID();

      await this.store.db.transaction(async (tx) => {
        await tx.insert(collections).values({ id: collectionId, name });

        await tx.insert(inCollection).values(
          productIds.map((el) => ({
            collectionId,
            productId: el,
          })),
        );
      });

      return collectionId;
    } catch (e) {
      handleError(e);
    }
  }

  async updateCollection(params: z.infer<typeof updateCollectionParamsSchema>) {
    try {
      const { name, productsToAdd, productsToRemove, id } =
        updateCollectionParamsSchema.parse(params);

      await this.store.db.transaction(async (tx) => {
        await tx
          .update(collections)
          .set({ name: name })
          .where(eq(collections.id, id));

        if (productsToAdd?.length) {
          await tx
            .insert(inCollection)
            .values(
              productsToAdd.map((el) => ({ collectionId: id, productId: el })),
            );
        }

        if (productsToRemove?.length) {
          await tx
            .delete(inCollection)
            .where(
              and(
                eq(inCollection.collectionId, id),
                inArray(inCollection.productId, productsToRemove),
              ),
            );
        }
      });
    } catch (e) {
      handleError(e);
    }
  }

  async removeCollection(id: z.infer<typeof deleteCollectionParamSchema>) {
    try {
      const data = deleteCollectionParamSchema.parse(id);

      await this.store.db.delete(collections).where(eq(collections.id, data));
    } catch (e) {
      handleError(e);
    }
  }
}
