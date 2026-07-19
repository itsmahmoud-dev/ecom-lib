import { EventEmitter } from "node:events";
import { drizzle } from "drizzle-orm/bun-sql";
import { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";

import * as models from "./db/schema";
import { relations } from "./db/relations";
import { Products } from "./Products";
import { Users } from "./Users";
import { Facets } from "./Facets";
import { CartItems } from "./CartItems";

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
  db: BunSQLDatabase<typeof relations>;

  // Repositories
  users: Users;
  products: Products;
  facets: Facets;
  cartItems: CartItems;

  emitter = new EventEmitter();

  constructor(params: StoreParams) {
    this.name = params.name;
    this.dataPath = params.dataPath;
    this.JWT_SECRET = params.JWT_SECRET;
    this.db = drizzle(params.dbUrl, { relations });

    this.products = new Products(this);
    this.users = new Users(this);
    this.facets = new Facets(this);
    this.cartItems = new CartItems(this);
  }
}
