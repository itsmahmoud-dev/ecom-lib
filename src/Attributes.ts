import { eq } from "drizzle-orm";
import { attributes } from "./db/schema";
import { handleError } from "./utils/errors";
import { insertOneOrThrow, mutateOneOrThrow } from "./utils/dbHelpers";
import {
  addAttributeParamSchema,
  removeAttributeParamSchema,
} from "./types/attributes.types";
import type { Store } from "./Store";
import type z from "zod";

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

      const attr = await insertOneOrThrow(
        this.store.db
          .insert(attributes)
          .values({ id: attrId, ...data })
          .returning(),
        "attribute",
      );

      return attr;
    } catch (e) {
      handleError(e);
    }
  }

  async removeAttribute(id: z.infer<typeof removeAttributeParamSchema>) {
    try {
      const validatedId = removeAttributeParamSchema.parse(id);

      await mutateOneOrThrow(
        this.store.db
          .delete(attributes)
          .where(eq(attributes.id, validatedId))
          .returning(),
        "attribute",
      );
    } catch (e) {
      handleError(e);
    }
  }
}
