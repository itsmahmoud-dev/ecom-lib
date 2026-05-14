import { Product } from "../product";
import { ProductGender } from "../../../types/product";
import type { ClothingProductOption } from "./clothingProductOption";
export declare class ClothingProduct extends Product {
    tags: string[] | undefined;
    readonly type: "clothing";
    gender: ProductGender;
    options: ClothingProductOption[];
}
