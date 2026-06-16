import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { ProductStatus } from "../types/product";
import type { ProductOption } from "./ProductOption";

@Entity({ name: "product" })
export class Product<
  attributes extends string[] = string[],
  optionAttributes extends string[] = string[],
> extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", unique: true, nullable: true })
  barcode?: string | null;

  @Column({ type: "enum", enum: ProductStatus, default: ProductStatus.PENDING })
  status!: ProductStatus;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "jsonb" })
  attributes!: Record<attributes[number], any>;

  @OneToMany("ProductOption", (o: ProductOption) => o.product, {
    eager: true,
    cascade: ["insert", "recover", "remove", "soft-remove", "update"],
  })
  options!: ProductOption<optionAttributes>[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Retrieves a product by its ID.
   * @param id The ID of the product.
   * @returns The product with the specified ID, or null if not found.
   */
  static findByID(id: number) {
    return Product.findOne({ where: { id } });
  }

  /**
   * Retrieves a product by its barcode.
   * @param barcode The barcode of the product.
   * @returns The product with the specified barcode, or null if not found.
   */
  static findByBarcode(barcode: string) {
    return Product.findOne({ where: { barcode } });
  }
}
