import { Store } from "../src";

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
});

await store.initializeDatabase();
