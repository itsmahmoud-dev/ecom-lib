import "reflect-metadata";
import { DataSource } from "typeorm";
import { EventEmitter } from "node:events";

import { FacetDefinations, Product, ProductOption, User } from "./db";
import { Products } from "./Products";
import { Users } from "./Users";

type StoreProps = {
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
  products: Products;
  users: Users;
  emitter = new EventEmitter();

  constructor(props: StoreProps) {
    this.name = props.name;
    this.dataPath = props.dataPath;
    this.JWT_SECRET = props.JWT_SECRET;
    this.dataSource = new DataSource({
      type: "postgres",
      host: props.db.HOST,
      port: props.db.PORT,
      username: props.db.USER,
      password: props.db.PASS,
      database: props.db.NAME,
      entities: [Product, ProductOption, FacetDefinations, User],
      synchronize: true,
      logging: false,
    });

    this.products = new Products(this);
    this.users = new Users(this);
  }

  async initializeDatabase() {
    try {
      await this.dataSource.initialize();
    } catch (e) {
      console.log(e);
    }
  }
}
