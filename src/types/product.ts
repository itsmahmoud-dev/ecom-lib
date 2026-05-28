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

export type ClothingAttributes = {
  type: "clothing";
  size: string;
  color: string;
};

export type ToyAttributes = {
  type: "toy";
  ageRange: string;
  color: string;
};

export type ProductAttributes = ClothingAttributes | ToyAttributes;
