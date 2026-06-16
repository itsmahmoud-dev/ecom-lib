import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UpdateDateColumn } from "typeorm/browser";
import { Column } from "typeorm/browser";
import type { User } from "./User";

@Entity({ name: "address" })
export class Address extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text" })
  country!: string;

  @Column({ type: "text" })
  state!: string;

  @Column({ type: "text" })
  city!: string;

  @Column({ type: "text" })
  street!: string;

  @Column({ type: "text" })
  building!: string;

  @Column({ type: "text", nullable: true })
  floor?: string | null;

  @ManyToOne("User", (user: User) => user.addresses, {
    onDelete: "CASCADE",
  })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
