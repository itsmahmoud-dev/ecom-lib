import { BaseEntity } from "typeorm";
import type { ClothingProduct } from "./clothingProduct";
export declare class ClothingProductOption extends BaseEntity {
    id: number;
    product: ClothingProduct;
    productId: number;
    size: string;
    color: string;
    quantity: number;
    price: number;
    discount: number;
    images: string[];
}
