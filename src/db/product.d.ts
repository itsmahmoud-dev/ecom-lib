import { BaseEntity } from "typeorm";
import { ProductStatus } from "../../types/product";
export declare class Product extends BaseEntity {
    id: number;
    name: string;
    barcode: string;
    active: ProductStatus;
    description: string;
    category: string;
    createdAt: Date;
    updatedAt: Date;
}
