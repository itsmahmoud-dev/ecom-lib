import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Product } from "./Product";

@Entity({ name: "product_variant" })
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Product", (p: Product) => p.variants, {
    onDelete: "CASCADE",
  })
  product!: Product;

  @Column({ type: "numeric" })
  productId!: number;

  @Column({ type: "jsonb" })
  attributes!: Record<string, unknown>;

  @Column({ type: "numeric" })
  price!: number;

  @Column({ type: "numeric", default: 0 })
  discount!: number;

  @Column({ type: "simple-array" })
  images!: string[];
}
