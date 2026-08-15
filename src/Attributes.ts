import { eq } from "drizzle-orm";

import { attributes } from "./db/schema/attributes.model";
import {
  AttributeErrorCodes,
  handleError,
  OperationalError,
} from "./lib/errors";

import type { Store } from "./Store";
import type z from "zod";
import {
  addAttributeParamSchema,
  removeAttributeParamSchema,
} from "./types/attributes.types";

export class Attributes {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Retrieves attributes by key.
   * @param key
   * @returns array of attributes matching the key
   */
  async getAttributesByKey(key: string) {
    return await this.store.db.query.attributes.findMany({
      where: { key },
    });
  }

  async getAttributesByParent(parentId: string) {
    return await this.store.db.query.attributes.findMany({
      where: { parentId },
    });
  }

  async addAttribute(params: z.infer<typeof addAttributeParamSchema>) {
    try {
      const data = addAttributeParamSchema.parse(params);

      const [attr] = await this.store.db
        .insert(attributes)
        .values({ ...data })
        .returning();

      if (!attr) {
        throw new Error("Error inserting an attribute");
      }

      return attr;
    } catch (e) {
      handleError(e);
    }
  }

  async removeAttribute(id: z.infer<typeof removeAttributeParamSchema>) {
    try {
      const validatedId = removeAttributeParamSchema.parse(id);

      const [attr] = await this.store.db
        .delete(attributes)
        .where(eq(attributes.id, validatedId))
        .returning();

      if (!attr) {
        throw new OperationalError({
          code: AttributeErrorCodes.AttributeNotFound,
          message: `Removing an attribute failed because it does not exist`,
        });
      }
    } catch (e) {
      handleError(e);
    }
  }
}
