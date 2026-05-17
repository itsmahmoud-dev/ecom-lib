import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserRole, UserStatus } from "../types/user";

@Entity({ name: "user" })
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", unique: true, nullable: true })
  email?: string;

  @Column({ type: "text", unique: true, nullable: true })
  phoneNumber?: string;

  @Column({ type: "text" })
  password!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.PENDING })
  status!: UserStatus;

  @Column({ type: "text", nullable: true })
  activationToken?: string;

  @Column({ type: "timestamptz", nullable: true })
  activationTokenExpiry?: Date;

  @Column({ type: "text", nullable: true })
  passwordResetToken?: string;

  @Column({ type: "timestamptz", nullable: true })
  passwordResetTokenExpiry?: Date;

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
