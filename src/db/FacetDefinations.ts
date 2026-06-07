import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "facet_definations" })
export class FacetDefinations extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  key!: string;

  @Column({ type: "text" })
  value!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
