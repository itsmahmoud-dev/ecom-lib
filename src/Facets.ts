import { eq } from "drizzle-orm";

import { facets } from "./models/facets.model";
import { OperError } from "./lib/OperError";
import { FacetErrorCodes, handleError, logMessage } from "./lib/errors";

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
    const facets = await this.store.db.query.facets.findMany({
      where: (f, { eq }) => eq(f.key, key),
    });
    return facets;
  }

  /**
   * Adds a new facet.
   * @param key
   * @param value
   * @returns The new facet
   * @throws {OperError} `F000` (`FacetAlreadyExists`) if the facet already exists
   */
  async addFacet(key: string, value: string, type: string) {
    try {
      const [facet] = await this.store.db
        .insert(facets)
        .values({ key, value, type })
        .returning();

      return facet;
    } catch (e) {
      handleError(e);
    }
  }

  /**
   * Removes a facet.
   * @param key
   * @param value
   * @throws {OperError} `F001` (`FacetNotFound`) if the facet is not found
   */
  async removeFacet(id: string) {
    const facet = await this.store.db.query.facets.findFirst({
      where: (f, { eq }) => eq(f.id, id),
    });

    if (!facet) {
      logMessage(
        "warn",
        `Attempt to delete a facet with id (${id}) failed becuase it does not exist`,
      );
      throw new OperError({
        code: FacetErrorCodes.FacetNotFound,
        message: "Facet was not found",
        cause: `Facet with id (${id}) does not exist`,
      });
    }

    await this.store.db.delete(facets).where(eq(facets.id, id));
  }
}
