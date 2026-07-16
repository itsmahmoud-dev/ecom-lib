import { EventEmitter } from "node:events";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";

import * as models from "./db/schema";
import { relations } from "./db/relations";
import { Products } from "./Products";
import { Users } from "./Users";
import { Facets } from "./Facets";

type StoreParams = {
  name: string;
  dataPath: string;
  dbUrl: string;
  JWT_SECRET: string;
};

export class Store {
  name: string;
  dataPath: string;
  JWT_SECRET: string;
  db: NodePgDatabase<typeof relations>;

  // Repositories
  users: Users;
  products: Products;
  facets: Facets;

  emitter = new EventEmitter();

  constructor(params: StoreParams) {
    this.name = params.name;
    this.dataPath = params.dataPath;
    this.JWT_SECRET = params.JWT_SECRET;
    this.db = drizzle(params.dbUrl, { relations });

    this.products = new Products(this);
    this.users = new Users(this);
    this.facets = new Facets(this);
  }
}
