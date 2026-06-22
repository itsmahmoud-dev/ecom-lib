import { Store } from "../src";
import { afterAll } from "bun:test";
import { rmSync } from "fs";
import { users } from "../src/models";

export const store = new Store({
  name: "Test Store",
  dataPath: "/home/mahmoud/development/personal/itsmahmoud-dev/ecom-lib/data",
  dbUrl: process.env.DATABASE_URL!,
  JWT_SECRET: "1234",
});

afterAll(async () => {
  await store.db.delete(users);
  rmSync(`${store.dataPath}/images/products/*`, { force: true });
});
