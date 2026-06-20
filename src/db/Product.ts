import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { ProductStatus } from "../types/product";
import type { ProductVariant } from "./ProductVariant";

@Entity({ name: "product" })
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", unique: true, nullable: true })
  barcode!: string | null;

  @Column({ type: "enum", enum: ProductStatus, default: ProductStatus.PENDING })
  status!: ProductStatus;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "jsonb" })
  attributes!: Record<string, unknown>;

  @OneToMany("ProductVariant", (o: ProductVariant) => o.product, {
    eager: true,
    cascade: ["insert", "recover", "remove", "soft-remove", "update"],
  })
  variants!: ProductVariant[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
