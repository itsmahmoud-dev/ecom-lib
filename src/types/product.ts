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

export type CreateProductParams = {
  name: string;
  barcode: string | null;
  status: ProductStatus;
  description: string;
  category: string;
  options: {
    attributes: ProductAttributes;
    price: number;
    discount: number;
    images: File[];
  }[];
};
