import "reflect-metadata";
import { DataSource } from "typeorm";
import { EventEmitter } from "node:events";

import { Address, FacetDefination, Product, ProductVariant, User } from "./db";
import { Products } from "./Products";
import { Users } from "./Users";
import { Facets } from "./Facets";

type StoreParams = {
  name: string;
  dataPath: string;
  db: {
    PORT: number;
    NAME: string;
    USER: string;
    PASS: string;
    HOST: string;
  };
  JWT_SECRET: string;
};

export class Store {
  name: string;
  dataSource: DataSource;
  dataPath: string;
  JWT_SECRET: string;

  // Repositories
  users: Users;
  products: Products;
  facets: Facets;

  emitter = new EventEmitter();

  constructor(params: StoreParams) {
    this.name = params.name;
    this.dataPath = params.dataPath;
    this.JWT_SECRET = params.JWT_SECRET;

    this.dataSource = new DataSource({
      type: "postgres",
      host: params.db.HOST,
      port: params.db.PORT,
      username: params.db.USER,
      password: params.db.PASS,
      database: params.db.NAME,
      entities: [Product, ProductVariant, FacetDefination, User, Address],
      synchronize: true,
      logging: false,
    });

    this.products = new Products(this);
    this.users = new Users(this);
    this.facets = new Facets(this);
  }

  async initializeDatabase() {
    try {
      await this.dataSource.initialize();
    } catch (e) {
      console.log(e);
    }
  }
}
