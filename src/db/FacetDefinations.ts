import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity({ name: "facet_defination" })
@Unique("key value pair", ["key", "value"])
export class FacetDefination {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  key!: string;

  @Column({ type: "text" })
  value!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
