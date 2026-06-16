import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserRole, UserStatus } from "../types/user";
import { OneToMany } from "typeorm/browser";
import type { Address } from "./Address";

@Entity({ name: "user" })
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", unique: true, nullable: true })
  email?: string | null;

  @Column({ type: "text", unique: true, nullable: true })
  phoneNumber?: string | null;

  @Column({ type: "text" })
  password!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.PENDING })
  status!: UserStatus;

  @Column({ type: "text", nullable: true })
  activationToken?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  activationTokenExpiry?: Date | null;

  @Column({ type: "text", nullable: true })
  emailChangeOtp?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  emailChangeOtpExpiry?: Date | null;

  @Column({ type: "text", nullable: true })
  passwordResetToken?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  passwordResetTokenExpiry?: Date | null;

  @OneToMany("Address", (address: Address) => address.user, {
    nullable: true,
    eager: true,
    cascade: ["insert", "recover", "remove", "soft-remove", "update"],
  })
  addresses?: Address[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  async verifyPassword(password: string) {
    return await Bun.password.verify(password, this.password, "argon2id");
  }

  static async hashPassword(password: string) {
    return await Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: 65536,
      timeCost: 3,
    });
  }
}
