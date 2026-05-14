import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  TableInheritance,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { ProductStatus } from "../../types/product";

@Entity()
@TableInheritance({ column: { type: "text", name: "type" } })
export class Product extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", unique: true })
  barcode!: string;

  @Column({ type: "enum", enum: ProductStatus, default: ProductStatus.PENDING })
  active!: ProductStatus;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "text" })
  category!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
