import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Product } from "./Product";
import type { ProductAttributes } from "../types";

@Entity({ name: "product_option" })
export class ProductOption extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Product", (p: Product) => p.options)
  product!: Product;

  @Column({ type: "numeric" })
  productId!: number;

  @Column({ type: "simple-json" })
  attributes!: ProductAttributes;

  @Column({ type: "numeric" })
  price!: number;

  @Column({ type: "numeric", default: 0 })
  discount!: number;

  @Column({ type: "simple-array" })
  images!: string[];
}
