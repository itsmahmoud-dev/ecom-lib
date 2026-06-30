import { Store } from "../src";
import { afterAll } from "bun:test";
import { $ } from "bun";
import { facets, products, users } from "../src/models";

export const store = new Store({
  name: "Test Store",
  dataPath: "/home/mahmoud/development/personal/itsmahmoud-dev/ecom-lib/data",
  dbUrl: process.env.DATABASE_URL!,
  JWT_SECRET: "1234",
});

afterAll(async () => {
  await store.db.delete(users);
  await store.db.delete(facets);
  await store.db.delete(products);
  await $`rm -f ${store.dataPath}/images/products/*`.quiet().nothrow();
});
