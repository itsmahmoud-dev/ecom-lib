import { EventEmitter } from "node:events";
import { drizzle } from "drizzle-orm/bun-sql";
import { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";

import { relations } from "./db/relations";
import { Products } from "./Products";
import { Users } from "./Users";
import { Facets } from "./Facets";
import { CartItems } from "./CartItems";
import { Collections } from "./Collections";

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
  collections: Collections;

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
    this.collections = new Collections(this);
  }
}
