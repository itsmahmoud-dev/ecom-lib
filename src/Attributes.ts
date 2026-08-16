import { eq } from "drizzle-orm";

import { attributes } from "./db/schema/attributes.model";
import { handleError } from "./utils/errors";

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
      const attrId = crypto.randomUUID();

      await this.store.db.insert(attributes).values({ id: attrId, ...data });

      return attrId;
    } catch (e) {
      handleError(e);
    }
  }

  async removeAttribute(id: z.infer<typeof removeAttributeParamSchema>) {
    try {
      const validatedId = removeAttributeParamSchema.parse(id);

      await this.store.db
        .delete(attributes)
        .where(eq(attributes.id, validatedId));
    } catch (e) {
      handleError(e);
    }
  }
}
