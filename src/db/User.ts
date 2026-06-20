import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserRole, UserStatus } from "../types/user";
import type { Address } from "./Address";

@Entity({ name: "user" })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", unique: true })
  email!: string;

  @Column({ type: "text", unique: true, nullable: true })
  phoneNumber!: string | null;

  @Column({ type: "text" })
  password!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.PENDING })
  status!: UserStatus;

  @Column({ type: "text", nullable: true })
  activationToken!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  activationTokenExpiry!: Date | null;

  @Column({ type: "text", nullable: true })
  emailChangeOtp!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  emailChangeOtpExpiry!: Date | null;

  @Column({ type: "text", nullable: true })
  passwordResetToken!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  passwordResetTokenExpiry!: Date | null;

  @OneToMany("Address", (address: Address) => address.user, {
    nullable: true,
    cascade: ["remove", "soft-remove"],
  })
  addresses!: Address[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  verifyPassword(password: string) {
    return Bun.password.verifySync(password, this.password, "argon2id");
  }

  static hashPassword(password: string) {
    return Bun.password.hashSync(password, {
      algorithm: "argon2id",
      memoryCost: 65536,
      timeCost: 3,
    });
  }
}
