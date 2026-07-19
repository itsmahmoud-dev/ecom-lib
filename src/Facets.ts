import { eq } from "drizzle-orm";

import { facets } from "./db/schema/facets.model";

import { FacetErrorCodes, handleError, OperationalError } from "./lib/errors";

import type { Store } from "./Store";

export class Facets {
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
    return await this.store.db.query.facets.findMany({
      where: { key },
    });
  }

  async getFacetsByParent(parentId: string) {
    return await this.store.db.query.facets.findMany({ where: { parentId } });
  }

  /**
   * Adds a new facet.
   * @param key
   * @param value
   * @returns The new facet
   * @throws {OperationalError} `F000` (`FacetAlreadyExists`) if the facet already exists
   */
  async addFacet(params: Omit<typeof facets.$inferInsert, "id" | "createdAt">) {
    try {
      const [facet] = await this.store.db
        .insert(facets)
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
      .delete(facets)
      .where(eq(facets.id, id))
      .returning();

    if (!facet) {
      throw new OperationalError({
        code: FacetErrorCodes.FacetNotFound,
        severity: "warning",
        userMessage: "Facet was not found",
        logMessage: `Removing a facet failed because it does not exist`,
        key: "id",
        value: id,
      });
    }
  }
}
