import "reflect-metadata";
import { DataSource } from "typeorm";
import { EventEmitter } from "node:events";

import { FacetDefination, Product, ProductOption, User } from "./db";
import { Products } from "./Products";
import { Users } from "./Users";
import { Facets } from "./Facets";

type StoreProps<
  productFacetKeys extends string[],
  productOptionFacetKeys extends string[],
> = {
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
  productFacetKeys: productFacetKeys;
  productOptionFacetKeys: productOptionFacetKeys;
};

export class Store<
  productFacetKeys extends string[] = string[],
  productOptionFacetKeys extends string[] = string[],
> {
  name: string;
  dataSource: DataSource;
  dataPath: string;
  JWT_SECRET: string;
  readonly productFacetKeys: productFacetKeys;
  readonly productOptionFacetKeys: productOptionFacetKeys;

  // Repositories
  users: Users;
  products: Products<productFacetKeys, productOptionFacetKeys>;
  facets: Facets<productFacetKeys, productOptionFacetKeys>;

  emitter = new EventEmitter();

  constructor(props: StoreProps<productFacetKeys, productOptionFacetKeys>) {
    this.name = props.name;
    this.dataPath = props.dataPath;
    this.JWT_SECRET = props.JWT_SECRET;
    this.productFacetKeys = props.productFacetKeys;
    this.productOptionFacetKeys = props.productOptionFacetKeys;

    this.dataSource = new DataSource({
      type: "postgres",
      host: props.db.HOST,
      port: props.db.PORT,
      username: props.db.USER,
      password: props.db.PASS,
      database: props.db.NAME,
      entities: [Product, ProductOption, FacetDefination, User],
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
