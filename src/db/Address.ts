import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from "typeorm";
import type { User } from "./User";

@Entity({ name: "address" })
export class Address {
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
  floor!: string | null;

  @ManyToOne("User", (user: User) => user.addresses, {
    onDelete: "CASCADE",
  })
  user!: User;

  @Column({ type: "numeric" })
  userId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
