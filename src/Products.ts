import type { Store } from "./Store";
import type { CreateProductParams, UpdateProductParams } from "./types";

export class Products {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Creates a new product.
   * @param p CreateProductParams
   * @returns the created product
   * @throws {OperError} with code P600 if the barcode already exists
   */
  async createProduct(p: CreateProductParams) {}

  /**
   * Updates an existing product.
   * @param params UpdateProductParams
   * @returns the updated product
   * @throws {OperError} with code P600 if the new barcode belongs to a different product
   * @throws {OperError} with code P601 if no product with the given id exists
   */
  async updateProduct(params: UpdateProductParams) {}

  /**
   * Deletes a product by its id.
   * @param id the id of the product to delete
   * @throws {OperError} with code P601 if no product with the given id exists
   */
  async deleteProduct(id: number) {}
}
