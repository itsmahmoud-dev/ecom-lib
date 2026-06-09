import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "facet_defination" })
@Unique("key value pair", ["key", "value"])
export class FacetDefination<
  keys extends string[] = string[],
> extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  key!: keys[number];

  @Column({ type: "text" })
  value!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
