import type { ClothingProduct } from "../db/clothing/clothingProduct";
import type { ClothingProductOption } from "../db/clothing/clothingProductOption";

export enum ProductType {
  CLOTHING = "clothing",
}

export enum ProductStatus {
  ACTIVE = "active",
  PENDING = "pending",
}

export enum ProductGender {
  MALE = "male",
  FEMALE = "female",
  UNISEX = "unisex",
}

export type ProductImage = {
  color: string;
  image: File;
};

export type createProductOptions = Pick<
  ClothingProduct,
  "name" | "barcode" | "active" | "description" | "category" | "tags" | "gender"
> & {
  options: Partial<ClothingProductOption>[];
};
