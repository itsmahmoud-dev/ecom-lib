import "reflect-metadata";
import { DataSource, type Repository } from "typeorm";
import { ClothingProduct } from "./db/clothing/clothingProduct";
import { Product } from "./db/product";
import type { createProductOptions, ProductImage } from "../types/product";
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
export declare class Store {
    name: string;
    dataSource: DataSource;
    dataPath: string;
    products: Repository<Product>;
    constructor(props: storeProps);
    createProduct(p: createProductOptions, imgs: ProductImage[]): Promise<ClothingProduct>;
}
export {};
