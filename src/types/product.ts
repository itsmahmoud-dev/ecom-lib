export enum ProductStatus {
  ACTIVE = "active",
  PENDING = "pending",
}

// -------------------------------------------------------------

export type CreateProductParams<
  productAttributes extends string[] = string[],
  productOptionAttributes extends string[] = string[],
> = {
  name: string;
  barcode?: string;
  status: ProductStatus;
  description: string;
  attributes: Record<productAttributes[number], string>;
  options: {
    attributes: Record<productOptionAttributes[number], string>;
    price: number;
    discount: number;
    images: File[];
  }[];
};

export type UpdateProductParams<
  productAttributes extends string[] = string[],
  productOptionAttributes extends string[] = string[],
> = {
  id: number;
  name?: string;
  barcode?: string | null;
  status?: ProductStatus;
  description?: string;
  attributes?: Record<productAttributes[number], string>;
  options?: {
    id: number;
    dirty?: boolean;
    attributes: Record<productOptionAttributes[number], string>;
    price: number;
    discount: number;
    imagesData: {
      file?: File;
      fileName?: string;
    }[];
  }[];
  imagesToDelete?: string[];
};
