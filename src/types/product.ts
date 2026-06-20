export enum ProductStatus {
  ACTIVE = "active",
  PENDING = "pending",
}

// -------------------------------------------------------------

export type CreateProductParams = {
  name: string;
  barcode: string | null;
  status: ProductStatus;
  description: string;
  attributes: Record<string, unknown>;
  variants: {
    attributes: Record<string, unknown>;
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
  attributes?: Record<string, unknown>;
  variants?: {
    id: number;
    dirty?: boolean;
    attributes: Record<string, unknown>;
    price: number;
    discount: number;
    imagesData: {
      file?: File;
      fileName?: string;
    }[];
  }[];
  imagesToDelete?: string[];
};
