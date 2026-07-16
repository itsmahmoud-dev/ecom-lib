import { Store } from "../src";

export const store = new Store({
  name: "Test Store",
  dataPath: "/home/mahmoud/development/personal/itsmahmoud-dev/ecom-lib/data",
  dbUrl: process.env.DATABASE_URL!,
  JWT_SECRET: "1234",
});
