import * as z from "zod";
import {
  addCollectionParamSchema,
  updateCollectionParamsSchema,
  deleteCollectionParamSchema,
} from "./types/collections.type";
import { handleError, NotFoundError } from "./utils/errors";
import { collections, inCollection } from "./db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  insertManyOrThrow,
  insertOneOrThrow,
  mutateManyOrThrow,
  mutateOneOrThrow,
} from "./utils/dbHelpers";
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

      const collection = await this.store.db.transaction(async (tx) => {
        const collection = await insertOneOrThrow(
          tx.insert(collections).values({ id: collectionId, name }).returning(),
          "collection",
        );

        const products = await insertManyOrThrow(
          tx
            .insert(inCollection)
            .values(
              productIds.map((el) => ({
                collectionId,
                productId: el,
              })),
            )
            .returning(),
          "collection items",
        );

        return {
          ...collection,
          products: products.map((el) => ({ id: el.productId })),
        };
      });

      return collection;
    } catch (e) {
      handleError(e);
    }
  }

  async updateCollection(params: z.infer<typeof updateCollectionParamsSchema>) {
    try {
      const { name, productsToAdd, productsToRemove, id } =
        updateCollectionParamsSchema.parse(params);

      const collection = await this.store.db.query.collections.findFirst({
        where: { id },
        with: { products: { columns: { id: true } } },
      });

      if (!collection) throw new NotFoundError("collection", `id: ${id}`);

      const updatedCollection = await this.store.db.transaction(async (tx) => {
        const updatedCollection = await mutateOneOrThrow(
          tx
            .update(collections)
            .set({ name: name })
            .where(eq(collections.id, id))
            .returning(),
          "collection",
        );

        if (productsToAdd?.length) {
          await insertManyOrThrow(
            tx
              .insert(inCollection)
              .values(
                productsToAdd.map((el) => ({ collectionId: id, productId: el })),
              ),
            "collection items",
          );
        }

        if (productsToRemove?.length) {
          await mutateManyOrThrow(
            tx
              .delete(inCollection)
              .where(
                and(
                  eq(inCollection.collectionId, id),
                  inArray(inCollection.productId, productsToRemove),
                ),
              ),
            "collection items",
          );
        }

        return {
          ...updatedCollection,
          products: [
            ...collection.products.filter(
              (el) => !productsToRemove?.includes(el.id),
            ),
            ...(productsToAdd ?? []).map((el) => ({ id: el })),
          ],
        };
      });

      return updatedCollection;
    } catch (e) {
      handleError(e);
    }
  }

  async removeCollection(id: z.infer<typeof deleteCollectionParamSchema>) {
    try {
      const data = deleteCollectionParamSchema.parse(id);

      await mutateOneOrThrow(
        this.store.db
          .delete(collections)
          .where(eq(collections.id, data))
          .returning(),
        "collection",
      );
    } catch (e) {
      handleError(e);
    }
  }
}
