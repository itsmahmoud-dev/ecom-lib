import { eq } from "drizzle-orm";

import { attributes } from "./db/schema/attributes.model";
import {
  AttributeErrorCodes,
  handleError,
  OperationalError,
} from "./lib/errors";

import type { Store } from "./Store";
import type z from "zod";
import { addAttributeSchema } from "./types/attributes.types";

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

  async addAttribute(params: z.infer<typeof addAttributeSchema>) {
    try {
      const data = addAttributeSchema.parse(params);

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

  async removeAttribute(id: string) {
    const [attr] = await this.store.db
      .delete(attributes)
      .where(eq(attributes.id, id))
      .returning();

    if (!attr) {
      throw new OperationalError({
        code: AttributeErrorCodes.AttributeNotFound,
        severity: "warning",
        userMessage: "Attribute was not found",
        logMessage: `Removing an attribute failed because it does not exist`,
        key: "id",
        value: id,
      });
    }
  }
}
