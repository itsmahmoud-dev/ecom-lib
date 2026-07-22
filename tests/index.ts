import { Store } from "../src";

export const store = new Store({
  name: "Test Store",
  dataPath: process.env.DATA_PATH!,
  dbUrl: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
});
