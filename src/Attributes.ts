import { eq } from "drizzle-orm";

import { attributes } from "./db/schema/attributes.model";
import { FacetErrorCodes, handleError, OperationalError } from "./lib/errors";

import type { Store } from "./Store";

export class Attributes {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Retrieves facets by key.
   * @param key
   * @returns array of facets matching the key
   */
  async getFacetsByKey(key: string) {
    return await this.store.db.query.attributes.findMany({
      where: { key },
    });
  }

  async getFacetsByParent(parentId: string) {
    return await this.store.db.query.attributes.findMany({
      where: { parentId },
    });
  }

  /**
   * Adds a new facet.
   * @param key
   * @param value
   * @returns The new facet
   * @throws {OperationalError} `F000` (`FacetAlreadyExists`) if the facet already exists
   */
  async addFacet(
    params: Omit<typeof attributes.$inferInsert, "id" | "createdAt">,
  ) {
    try {
      const [facet] = await this.store.db
        .insert(attributes)
        .values({ ...params })
        .returning();

      if (!facet) {
        throw new OperationalError({
          code: "",
          severity: "error",
          logMessage: "Error inserting a facet",
          userMessage: "Something went wrong",
        });
      }

      return facet;
    } catch (e) {
      handleError(e);
    }
  }

  /**
   * Removes a facet.
   * @param key
   * @param value
   * @throws {OperationalError} `F001` (`FacetNotFound`) if the facet is not found
   */
  async removeFacet(id: string) {
    const [facet] = await this.store.db
      .delete(attributes)
      .where(eq(attributes.id, id))
      .returning();

    if (!facet) {
      throw new OperationalError({
        code: FacetErrorCodes.FacetNotFound,
        severity: "warning",
        userMessage: "Attribute was not found",
        logMessage: `Removing an attribute failed because it does not exist`,
        key: "id",
        value: id,
      });
    }
  }
}
