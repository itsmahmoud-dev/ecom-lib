import type { Store } from "./Store";

export class Facets {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Add a facet.
   * @param key
   * @param value
   * @returns created facet
   * @throws {OperError} with code F600 if the facet already exists
   */
  async addFacet(key: string, value: string) {}

  /**
   * Remove a facet.
   * @param key
   * @param value
   * @throws {OperError} with code F601 if the facet is not found
   */
  async removeFacet(key: string, value: string) {}
}
