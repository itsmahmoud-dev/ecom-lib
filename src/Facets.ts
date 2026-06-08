import { FacetDefination } from "./db";

import type { Repository } from "typeorm";
import type { Store } from "./Store";

export class Facets<
  productFacetKeys extends string[],
  productOptionFacetKeys extends string[],
> {
  repository: Repository<FacetDefination>;
  store: Store<productFacetKeys, productOptionFacetKeys>;

  constructor(store: Store<productFacetKeys, productOptionFacetKeys>) {
    this.store = store;
    this.repository = store.dataSource.getRepository(FacetDefination);
  }

  async addFacet(
    key: productFacetKeys[number] | productOptionFacetKeys[number],
    value: string,
  ) {
    const facet = new FacetDefination();
    facet.key = key;
    facet.value = value;
    await this.repository.save(facet);
  }
}
