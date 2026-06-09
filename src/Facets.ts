import { QueryFailedError } from "typeorm";
import { FacetDefination } from "./db";
import { OperError } from "./lib/OperError";
import { extractKeyValue } from "./lib/string";
import { FacetErrorCodes } from "./types/error";

import type { Store } from "./Store";
import type { Repository, FindOptionsWhereProperty } from "typeorm";

export class Facets<
  productFacetKeys extends string[] = string[],
  productOptionFacetKeys extends string[] = string[],
> {
  repository: Repository<
    FacetDefination<productFacetKeys | productOptionFacetKeys>
  >;
  store: Store<productFacetKeys, productOptionFacetKeys>;

  constructor(store: Store<productFacetKeys, productOptionFacetKeys>) {
    this.store = store;
    this.repository =
      store.dataSource.getRepository<
        FacetDefination<productFacetKeys | productOptionFacetKeys>
      >(FacetDefination);
  }

  async addFacet(
    key: productFacetKeys[number] | productOptionFacetKeys[number],
    value: string,
  ) {
    try {
      const facet = new FacetDefination<
        productFacetKeys | productOptionFacetKeys
      >();
      facet.key = key;
      facet.value = value;
      return await this.repository.save(facet);
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

  async removeFacet(
    key: FindOptionsWhereProperty<
      productFacetKeys[number] | productOptionFacetKeys[number]
    >,
    value: string,
  ) {
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
    await facet.remove();
  }
}
