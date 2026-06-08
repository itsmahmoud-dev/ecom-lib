import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Product } from "./Product";

@Entity({ name: "product_option" })
export class ProductOption<
  attributes extends string[] = string[],
> extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Product", (p: Product) => p.options, { onDelete: "CASCADE" })
  product!: Product;

  @Column({ type: "numeric" })
  productId!: number;

  @Column({ type: "simple-json" })
  attributes!: Record<attributes[number], any>;

  @Column({ type: "numeric" })
  price!: number;

  @Column({ type: "numeric", default: 0 })
  discount!: number;

  @Column({ type: "simple-array" })
  images!: string[];
}
