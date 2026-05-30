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
export class Product extends BaseEntity {
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

  @Column({ type: "text" })
  category!: string;

  @OneToMany("ProductOption", (o: ProductOption) => o.product)
  options!: ProductOption[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
