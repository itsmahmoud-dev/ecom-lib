import crypto from "crypto";
import { sign } from "jsonwebtoken";
import { and, eq, sql } from "drizzle-orm";
import {
  handleError,
  AlreadyExistsError,
  NotFoundError,
  CustomError,
  CustomErrorCodes,
} from "./utils/errors";
import { addresses, users } from "./db/schema";
import { hashPassword, verifyPassword } from "./utils/string";
import { insertOneOrThrow, mutateOneOrThrow } from "./utils/dbHelpers";
import type { Store } from "./Store";
import type z from "zod";
import {
  addAddressParamsSchema,
  changeEmailParamsSchema,
  changeNameParamsSchema,
  changePasswordParamsSchema,
  deleteAddressParamsSchema,
  logUserInParamsSchema,
  registerUserParamsSchema,
  requestChangeEmailParamsSchema,
  requestResetPasswordParamsSchema,
  resetPasswordParamsSchema,
  updateAddressParamsSchema,
  verifyUserParamsSchema,
} from "./types/user.types";

export class Users {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async registerUser(params: z.infer<typeof registerUserParamsSchema>) {
    try {
      const { email, name, password } = registerUserParamsSchema.parse(params);

      const existingUser = await this.store.db.query.users.findFirst({
        where: { email },
      });

      if (existingUser) throw new AlreadyExistsError("user", `email: ${email}`);

      const user = await insertOneOrThrow(
        this.store.db
          .insert(users)
          .values({
            name,
            email,
            password: hashPassword(password),
            verificationOtp: crypto.randomBytes(3).toHex().toUpperCase(),
            verificationOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          })
          .returning(),
        "user",
      );

      return user;
    } catch (e) {
      handleError(e);
    }
  }

  async verifyUser(params: z.infer<typeof verifyUserParamsSchema>) {
    try {
      const { email, otp, rememberMe } = verifyUserParamsSchema.parse(params);

      const user = await this.store.db.query.users.findFirst({
        where: { email },
      });

      if (!user) throw new NotFoundError("user", `email: ${email}`);

      if (user.verificationOtp !== otp)
        throw new CustomError(CustomErrorCodes.InvalidVerificationOtp);

      if (
        user.verificationOtpExpiresAt &&
        user.verificationOtpExpiresAt < new Date()
      ) {
        await this.store.db
          .update(users)
          .set({ verificationOtp: null, verificationOtpExpiresAt: null })
          .where(eq(users.id, user.id));
        throw new CustomError(CustomErrorCodes.ExpiredVerificationOtp);
      }

      const updatedUser = await mutateOneOrThrow(
        this.store.db
          .update(users)
          .set({
            status: "verified",
            verificationOtp: null,
            verificationOtpExpiresAt: null,
          })
          .where(eq(users.id, user.id))
          .returning(),
        "user",
        `id: ${user.id}`,
      );

      const accessToken = sign({ id: user.id }, this.store.JWT_SECRET, {
        jwtid: user.accessTokenId.toString(),
        algorithm: "HS512",
        expiresIn: rememberMe ? "30d" : "1d",
      });

      return { ...updatedUser, accessToken };
    } catch (e) {
      handleError(e);
    }
  }

  async logUserIn(params: z.infer<typeof logUserInParamsSchema>) {
    try {
      const { email, password, rememberMe } =
        logUserInParamsSchema.parse(params);

      const user = await this.store.db.query.users.findFirst({
        where: {
          email,
        },
      });

      if (!user) throw new NotFoundError("user", `email: ${email}`);

      if (user.status !== "verified")
        throw new CustomError(CustomErrorCodes.AccountNotVerified);

      if (!verifyPassword(password, user?.password))
        throw new CustomError(CustomErrorCodes.IncorrectPassword);

      const accessToken = sign({ id: user.id }, this.store.JWT_SECRET, {
        jwtid: user.accessTokenId.toString(),
        algorithm: "HS512",
        expiresIn: rememberMe ? "30d" : "1d",
      });

      return { ...user, accessToken };
    } catch (e) {
      handleError(e);
    }
  }

  async changeName(params: z.infer<typeof changeNameParamsSchema>) {
    try {
      const { id, name } = changeNameParamsSchema.parse(params);

      const user = await mutateOneOrThrow(
        this.store.db
          .update(users)
          .set({ name })
          .where(and(eq(users.id, id), eq(users.status, "verified")))
          .returning(),
        "user",
        `id: ${id} & status: verified`,
      );

      return user;
    } catch (e) {
      handleError(e);
    }
  }

  async requestChangeEmail(
    params: z.infer<typeof requestChangeEmailParamsSchema>,
  ) {
    try {
      const { id, newEmail } = requestChangeEmailParamsSchema.parse(params);

      const existingUser = await this.store.db.query.users.findFirst({
        where: {
          email: newEmail,
        },
      });

      if (existingUser) {
        if (existingUser.id === id)
          throw new CustomError(CustomErrorCodes.RequestingSameEmailChange);

        throw new AlreadyExistsError("user", `email: ${newEmail}`);
      }

      const user = await mutateOneOrThrow(
        this.store.db
          .update(users)
          .set({
            emailChangeOtp: crypto.randomBytes(3).toHex().toUpperCase(),
            emailChangeOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          })
          .where(and(eq(users.id, id), eq(users.status, "verified")))
          .returning(),
        "user",
        `id: ${id} & status: verified`,
      );

      return user;
    } catch (e) {
      handleError(e);
    }
  }

  async changeEmail(params: z.infer<typeof changeEmailParamsSchema>) {
    try {
      const { id, newEmail, otp, password } =
        changeEmailParamsSchema.parse(params);
      const existingUser = await this.store.db.query.users.findFirst({
        where: {
          email: newEmail,
        },
      });

      if (existingUser)
        throw new AlreadyExistsError("user", `email: ${newEmail}`);

      const user = await this.store.db.query.users.findFirst({
        where: {
          id,
          status: "verified",
        },
      });

      if (!user) throw new NotFoundError("user", `id: ${id} & status: verified`);

      if (user.emailChangeOtp !== otp)
        throw new CustomError(CustomErrorCodes.InvalidEmailChangeOtp);

      if (
        user.emailChangeOtpExpiresAt &&
        user.emailChangeOtpExpiresAt < new Date()
      ) {
        await this.store.db
          .update(users)
          .set({ emailChangeOtp: null, emailChangeOtpExpiresAt: null })
          .where(eq(users.id, id));
        throw new CustomError(CustomErrorCodes.ExpiredEmailChangeOtp);
      }

      if (!verifyPassword(password, user.password))
        throw new CustomError(CustomErrorCodes.IncorrectPassword);

      const updatedUser = await mutateOneOrThrow(
        this.store.db
          .update(users)
          .set({
            email: newEmail,
            emailChangeOtp: null,
            emailChangeOtpExpiresAt: null,
            accessTokenId: sql`(${users.accessTokenId} + 1) % 1000`,
          })
          .where(eq(users.id, id))
          .returning(),
        "user",
        `id: ${id}`,
      );

      return updatedUser;
    } catch (e) {
      handleError(e);
    }
  }

  async changePassword(params: z.infer<typeof changePasswordParamsSchema>) {
    try {
      const { id, newPassword, oldPassword } =
        changePasswordParamsSchema.parse(params);
      const user = await this.store.db.query.users.findFirst({
        where: {
          id,
          status: "verified",
        },
      });

      if (!user) throw new NotFoundError("user", `id: ${id} & status: verified`);

      if (!verifyPassword(oldPassword, user.password))
        throw new CustomError(CustomErrorCodes.IncorrectPassword);

      const updatedUser = mutateOneOrThrow(
        this.store.db
          .update(users)
          .set({
            password: hashPassword(newPassword),
            accessTokenId: sql`(${users.accessTokenId} + 1) % 1000`,
          })
          .where(eq(users.id, id))
          .returning(),
        "user",
        `id: ${id}`,
      );

      return updatedUser;
    } catch (e) {
      handleError(e);
    }
  }

  async requestPasswordReset(
    email: z.infer<typeof requestResetPasswordParamsSchema>,
  ) {
    try {
      const validatedEmail = requestResetPasswordParamsSchema.parse(email);

      const user = await mutateOneOrThrow(
        this.store.db
          .update(users)
          .set({
            passwordResetToken: crypto.randomBytes(32).toHex(),
            passwordResetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          })
          .where(
            and(eq(users.email, validatedEmail), eq(users.status, "verified")),
          )
          .returning(),
        "user",
        `email: ${validatedEmail} & status: verified`,
      );

      return user;
    } catch (e) {
      handleError(e);
    }
  }

  async resetPassword(params: z.infer<typeof resetPasswordParamsSchema>) {
    try {
      const { newPassword, token } = resetPasswordParamsSchema.parse(params);

      const user = await this.store.db.query.users.findFirst({
        where: {
          passwordResetToken: token,
          status: "verified",
        },
      });

      if (!user) throw new NotFoundError("user", "passwordResetToken");

      if (
        user.passwordResetTokenExpiresAt &&
        user.passwordResetTokenExpiresAt < new Date()
      ) {
        await this.store.db
          .update(users)
          .set({ passwordResetToken: null, passwordResetTokenExpiresAt: null })
          .where(eq(users.id, user.id));
        throw new CustomError(CustomErrorCodes.ExpiredPasswordResetToken);
      }

      const updatedUser = await mutateOneOrThrow(
        this.store.db
          .update(users)
          .set({
            password: hashPassword(newPassword),
            passwordResetToken: null,
            passwordResetTokenExpiresAt: null,
            accessTokenId: sql`(${users.accessTokenId} + 1) % 1000`,
          })
          .where(eq(users.id, user.id))
          .returning(),
        "user",
        `passwordResetToken`,
      );

      return updatedUser;
    } catch (e) {
      handleError(e);
    }
  }

  async addAddress(params: z.infer<typeof addAddressParamsSchema>) {
    try {
      const { address, userId } = addAddressParamsSchema.parse(params);

      const newAddress = await insertOneOrThrow(
        this.store.db
          .insert(addresses)
          .values({
            userId,
            ...address,
          })
          .returning(),
        "address",
      );

      return newAddress;
    } catch (e) {
      handleError(e);
    }
  }

  async updateAddress(params: z.infer<typeof updateAddressParamsSchema>) {
    try {
      const { id, ...address } = updateAddressParamsSchema.parse(params);

      const updatedAddress = await mutateOneOrThrow(
        this.store.db
          .update(addresses)
          .set({ ...address })
          .where(eq(addresses.id, id))
          .returning(),
        "address",
      );

      return updatedAddress;
    } catch (e) {
      handleError(e);
    }
  }

  async removeAddress(id: z.infer<typeof deleteAddressParamsSchema>) {
    try {
      const validatedId = deleteAddressParamsSchema.parse(id);

      await mutateOneOrThrow(
        this.store.db
          .delete(addresses)
          .where(eq(addresses.id, validatedId))
          .returning(),
        "address",
      );
    } catch (e) {
      handleError(e);
    }
  }
}
