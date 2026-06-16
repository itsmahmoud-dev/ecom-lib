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
    cascade: ["remove", "soft-remove"],
  })
  addresses?: Address[] | null;

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

  /**
   * Retrieves a user by their ID
   * @param id
   * @returns user if found, otherwise null
   */
  async findByID(id: number) {
    return await User.findOne({
      where: { id },
      select: [
        "id",
        "name",
        "email",
        "phoneNumber",
        "role",
        "status",
        "createdAt",
        "updatedAt",
      ],
    });
  }
}
