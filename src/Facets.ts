import { QueryFailedError } from "typeorm";
import { FacetDefination } from "./db";
import { OperError } from "./lib/OperError";
import { extractKeyValue } from "./lib/string";
import { FacetErrorCodes } from "./types/error";

import type { Store } from "./Store";
import type { Repository } from "typeorm";

export class Facets {
  repository: Repository<FacetDefination>;
  store: Store;

  constructor(store: Store) {
    this.store = store;
    this.repository = store.dataSource.getRepository(FacetDefination);
  }

  /**
   * Add a facet.
   * @param key
   * @param value
   * @returns created facet
   * @throws {OperError} with code F600 if the facet already exists
   */
  async addFacet(key: string, value: string) {
    try {
      const facet = this.repository.create({ key, value });
      await this.repository.save(facet);
      return facet;
    } catch (err) {
      if (err instanceof QueryFailedError && err.driverError.code === "23505") {
        const [key, value] = extractKeyValue(err.driverError.detail);
        throw new OperError({
          code: FacetErrorCodes.FacetAlreadyExists,
          message: `Facet already exists`,
          cause:
            "The user is trying to create a facet with a duplicate key and value",
          key,
          value,
        });
      }
      throw err;
    }
  }

  /**
   * Remove a facet.
   * @param key
   * @param value
   * @throws {OperError} with code F601 if the facet is not found
   */
  async removeFacet(key: string, value: string) {
    const facet = await this.repository.findOne({ where: { key, value } });
    if (!facet) {
      throw new OperError({
        code: FacetErrorCodes.FacetNotFound,
        message: `Facet not found`,
        cause: "The user is trying to remove a facet that does not exist",
        key: key.toString(),
        value,
      });
    }
    await this.repository.remove(facet);
  }
}
