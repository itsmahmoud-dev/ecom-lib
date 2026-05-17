import "reflect-metadata";
import { DataSource } from "typeorm";
import { Product, ClothingProduct, ClothingProductOption } from "./db";

import { Products } from "./Products";
import { Users } from "./Users";

type storeProps = {
  name: string;
  dataPath: string;
  db: {
    PORT: number;
    NAME: string;
    USER: string;
    PASS: string;
    HOST: string;
  };
};

export class Store {
  name: string;
  dataSource: DataSource;
  dataPath: string;
  products: Products;
  users: Users;

  constructor(props: storeProps) {
    this.name = props.name;
    this.dataPath = props.dataPath;
    this.dataSource = new DataSource({
      type: "postgres",
      host: props.db.HOST,
      port: props.db.PORT,
      username: props.db.USER,
      password: props.db.PASS,
      database: props.db.NAME,
      entities: [Product, ClothingProduct, ClothingProductOption, Users],
      synchronize: true,
      logging: false,
    });

    this.products = new Products(this);
    this.users = new Users(this);

    try {
      this.dataSource.initialize();
    } catch (e) {
      console.log(e);
    }
  }
}
