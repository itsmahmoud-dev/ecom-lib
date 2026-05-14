import { BaseEntity, Column, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { ClothingProduct } from "./clothingProduct";

export class ClothingProductOption extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("ClothingProduct", (p: ClothingProduct) => p.options)
  product!: ClothingProduct;

  @Column({ type: "numeric" })
  productId!: number;

  @Column({ type: "text" })
  size!: string;

  @Column({ type: "text" })
  color!: string;

  @Column({ type: "numeric" })
  quantity!: number;

  @Column({ type: "numeric" })
  price!: number;

  @Column({ type: "numeric", default: 0 })
  discount!: number;

  @Column({ type: "simple-array" })
  images!: string[];
}
