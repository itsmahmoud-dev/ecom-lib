import { Store } from "../src";
import { afterAll } from "bun:test";
import { rmSync } from "fs";

export const store = new Store({
  name: "Test Store",
  dataPath: "/home/mahmoud/development/personal/itsmahmoud-dev/ecom-lib/data",
  db: {
    PORT: 5432,
    NAME: "ecom_lib_test",
    USER: "mahmoud",
    PASS: "mahmoud282003",
    HOST: "localhost",
  },
  JWT_SECRET: "1234",
  productFacetKeys: ["category", "gender"] as const,
  productOptionFacetKeys: ["color", "size"] as const,
});

await store.initializeDatabase();

afterAll(async () => {
  await store.users.repository.deleteAll();
  await store.products.repository.deleteAll();
  await store.facets.repository.deleteAll();
  rmSync(`${store.dataPath}/images/products/*`, { force: true });
});
