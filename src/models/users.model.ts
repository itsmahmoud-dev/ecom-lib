import { pgEnum, pgTable } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("role", ["admin", "user", "customer"]);

export const userStatusEnum = pgEnum("status", ["verified", "pending"]);

export const users = pgTable("users", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),

  name: t.text().notNull(),

  email: t.text().notNull().unique(),

  phoneNumber: t.text().unique(),

  password: t.text().notNull(),

  role: userRoleEnum().notNull().default("customer"),

  status: userStatusEnum().notNull().default("pending"),

  verificationOtp: t.varchar({ length: 6 }),

  verificationOtpExpiresAt: t.timestamp({ withTimezone: true }),

  emailChangeOtp: t.varchar({ length: 6 }),

  emailChangeOtpExpiresAt: t.timestamp({ withTimezone: true }),

  passwordResetToken: t.text(),

  accessTokenId: t.text().default("1").notNull(),

  passwordResetTokenExpiresAt: t.timestamp({ withTimezone: true }),

  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),

  updatedAt: t
    .timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));

export function hashPassword(password: string) {
  return Bun.password.hashSync(password, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 3,
  });
}

export function verifyPassword(password: string, hashedPassword: string) {
  return Bun.password.verifySync(password, hashedPassword, "argon2id");
}
