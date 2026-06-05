export enum ProductStatus {
  ACTIVE = "active",
  PENDING = "pending",
}

export enum ProductGender {
  MALE = "male",
  FEMALE = "female",
  UNISEX = "unisex",
}

// -------------------------------------------------------------

export type ClothingAttributes = {
  type: "clothing";
  category: string;
  gender: ProductGender;
};

export type ToyAttributes = {
  type: "toy";
  category: string;
  gender: ProductGender;
  ageRange: string;
};

export type ProductAttributes = ClothingAttributes | ToyAttributes;

// -------------------------------------------------------------

export type ClothingOptionAttributes = {
  type: "clothing";
  size: string;
  color: string;
};

export type ToyOptionAttributes = {
  type: "toy";
  color: string;
};

export type ProductOptionAttributes =
  | ClothingOptionAttributes
  | ToyOptionAttributes;

// -------------------------------------------------------------

export type CreateProductParams = {
  name: string;
  barcode?: string;
  status: ProductStatus;
  description: string;
  attributes: ProductAttributes;
  options: {
    attributes: ProductOptionAttributes;
    price: number;
    discount: number;
    images: File[];
  }[];
};

export type UpdateProductParams = {
  id: number;
  name?: string;
  barcode?: string | null;
  status?: ProductStatus;
  description?: string;
  attributes?: ProductAttributes;
  options?: {
    id: number;
    dirty?: boolean;
    attributes: ProductOptionAttributes;
    price: number;
    discount: number;
    imagesData: {
      file?: File;
      fileName?: string;
    }[];
  }[];
  imagesToDelete?: string[];
};
