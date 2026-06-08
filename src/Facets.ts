import { FacetDefination } from "./db";

import type { Repository } from "typeorm";
import type { Store } from "./Store";

export class Facets<
  productFacetKeys extends string[],
  productOptionFacetKeys extends string[],
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
    const facet = new FacetDefination<
      productFacetKeys | productOptionFacetKeys
    >();
    facet.key = key;
    facet.value = value;
    await this.repository.save(facet);
  }
}
