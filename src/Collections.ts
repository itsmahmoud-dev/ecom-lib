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
        const [collection] = await tx
          .insert(collections)
          .values({ name, id: collectionId })
          .returning();

        if (!collection) {
          throw new Error("Error inserting collection");
        }

        await tx
          .insert(inCollection)
          .values(
            productIds.map((el) => ({
              collectionId: collection.id,
              productId: el,
            })),
          )
          .returning();
      });

      return await this.store.db.query.collections.findFirst({
        where: { id: collectionId },
        with: {
          products: {
            columns: { name: true },
            with: { variants: { columns: {}, with: { images: true } } },
          },
        },
      });
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

      const [collection] = await this.store.db
        .delete(collections)
        .where(eq(collections.id, data))
        .returning();

      if (!collection) {
        throw new OperationalError({
          code: CollectionErrorCodes.CollectionNotFound,
          message: "Removing collection failed because it does not exist",
        });
      }
    } catch (e) {
      handleError(e);
    }
  }
}
