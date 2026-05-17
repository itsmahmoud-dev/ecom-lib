import { ChildEntity, Column, OneToMany } from "typeorm";
import { Product } from "../Product";
import { ProductGender } from "../../types/product";
import type { ClothingProductOption } from "./clothingProductOption";

@ChildEntity()
export class ClothingProduct extends Product {
  @Column({ type: "simple-array", nullable: true })
  tags!: string[] | undefined;

  readonly type = "clothing" as const;

  @Column({ type: "enum", enum: ProductGender })
  gender!: ProductGender;

  @OneToMany("ClothingProductOption", (o: ClothingProductOption) => o.product, {
    cascade: true,
    eager: true,
  })
  options!: ClothingProductOption[];
}
