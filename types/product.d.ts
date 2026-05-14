import type { ClothingProduct } from "../src/db/clothing/clothingProduct";
import type { ClothingProductOption } from "../src/db/clothing/clothingProductOption";
export declare enum ProductType {
    CLOTHING = "clothing"
}
export declare enum ProductStatus {
    ACTIVE = "active",
    PENDING = "pending"
}
export declare enum ProductGender {
    MALE = "male",
    FEMALE = "female",
    UNISEX = "unisex"
}
export type ProductImage = {
    color: string;
    image: File;
};
export type createProductOptions = Pick<ClothingProduct, "name" | "barcode" | "active" | "description" | "category" | "tags" | "gender"> & {
    options: Partial<ClothingProductOption>[];
};
