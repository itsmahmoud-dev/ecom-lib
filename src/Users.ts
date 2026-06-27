import crypto, { KeyObject } from "crypto";
import { sign } from "jsonwebtoken";
import { eq } from "drizzle-orm";

import { OperError } from "./lib/OperError";
import { logMessage, UserErrorCodes, handleError } from "./lib/errors";
import { hashPassword, users, verifyPassword } from "./models";

import type { Store } from "./Store";

export class Users {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Retrieves a user by their ID. Sensitive fields (password, OTPs) are excluded from the result.
   * @param id The user's UUID
   * @returns The user object without sensitive fields
   * @throws {OperError} `U000` (`UserNotFound`) if no user exists with the given ID
   */
  async findByID(id: string) {
    const user = await this.store.db.query.users.findFirst({
      columns: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      where: (user, { eq, and }) =>
        and(eq(user.id, id), eq(user.status, "verified")),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to find a user with id (${id}) failed because the user does not exist.`,
      );

      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: `User with id (${id}) does not exist`,
        key: "id",
        value: id,
      });
    }

    return user;
  }

  /**
   * Creates a new user account with a hashed password and a verification OTP valid for 10 minutes.
   * The caller is responsible for delivering the OTP to the user's email.
   * @param name The user's display name
   * @param email The user's email address
   * @param password Plaintext password (hashed before storing)
   * @returns `{ id, otp, name, email }` — the created user's data and the raw OTP to send via email
   * @throws {OperError} `U005` (`EmailAlreadyRegistered`) if the email is already in use
   */
  async registerUser(name: string, email: string, password: string) {
    try {
      const otp = crypto.randomBytes(3).toHex();

      const [user] = await this.store.db
        .insert(users)
        .values({
          name,
          email,
          password: hashPassword(password),
          verificationOtp: otp,
          verificationOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
        });

      if (!user) {
        logMessage(
          "error",
          `Attempt to register a new user with email (${email}) failed.`,
        );
        throw new Error("Error inserting a new user");
      }

      return {
        id: user.id,
        otp,
        name: user.name,
        email: user.email,
      };
    } catch (e) {
      handleError(e);
    }
  }

  /**
   * Verifies a user's account using the OTP sent during registration.
   * Sets the account status to "verified" and clears the OTP on success.
   * @param otp The 6-character hex OTP from the registration email
   * @throws {OperError} `U004` (`VerificationOtpInvalidOrExpired`) if the OTP doesn't match any user or has expired
   */
  async verifyUser(otp: string) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq }) => eq(user.verificationOtp, otp),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to verify user with otp (${otp}) failed because the user with this verification token does not exist.`,
      );

      throw new OperError({
        code: UserErrorCodes.VerificationOtpInvalidOrExpired,
        message: "Verification code is invalid or has expired",
        cause: `Verification OTP (${otp}) is invalid`,
      });
    }

    if (
      user?.verificationOtpExpiresAt &&
      user.verificationOtpExpiresAt < new Date()
    ) {
      await this.store.db
        .update(users)
        .set({ verificationOtp: null, verificationOtpExpiresAt: null })
        .where(eq(users.id, user.id));

      logMessage(
        "info",
        `Attempt to verify user with email (${user.email}) failed because the token has been expired for ${((Date.now() - user.verificationOtpExpiresAt.getTime()) / 60000).toFixed(2)} minutes.`,
      );

      throw new OperError({
        code: UserErrorCodes.VerificationOtpInvalidOrExpired,
        message: "Verification code is invalid or has expired",
        cause: `Verification OTP for user with email (${user.email}) has been expired for ${((Date.now() - user.verificationOtpExpiresAt!.getTime()) / 60000).toFixed(2)} minutes`,
      });
    }

    await this.store.db
      .update(users)
      .set({
        verificationOtp: null,
        verificationOtpExpiresAt: null,
        status: "verified",
      })
      .where(eq(users.id, user.id));
  }

  /**
   * Authenticates a user with email and password, returning a signed JWT access token.
   * @param email The user's email address
   * @param password The user's plaintext password
   * @param rememberMe When true, the token expires in 30 days instead of 1 day
   * @returns A signed HS512 JWT access token
   * @throws {OperError} `U001` (`InvalidEmailOrPassword`) if the email doesn't exist or the password is wrong
   * @throws {OperError} `U003` (`AccountNotVerified`) if the user hasn't verified their account
   */
  async logUserIn(email: string, password: string, rememberMe: boolean = false) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq }) => eq(user.email, email),
    });

    if (!user) {
      logMessage(
        "info",
        `Attempt to log user in with email (${email}) failed because a user with this email does not exist.`,
      );
      throw new OperError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        message: "Email or password is incorrect",
        cause: `User with email (${email}) does not exist`,
        key: "email",
        value: email,
      });
    }

    if (user.status !== "verified") {
      logMessage(
        "info",
        `Attempt to log user in with email (${email}) failed because the account is not verified.`,
      );
      throw new OperError({
        code: UserErrorCodes.AccountNotVerified,
        message: "Account not verified",
        cause: `User with email (${email}) has not verified their account`,
        key: "email",
        value: email,
      });
    }

    if (!verifyPassword(password, user?.password)) {
      // TODO: set rate limiter for failed retries
      logMessage(
        "info",
        `Attempt to log user in with email (${email}) failed because the password is incorrect.`,
      );
      throw new OperError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        message: "Email or password is incorrect",
        cause: `Password is incorrect for user with email (${email})`,
        key: "password",
      });
    }

    const accessToken = sign({ id: user.id }, this.store.JWT_SECRET, {
      jwtid: user.accessTokenId,
      algorithm: "HS512",
      expiresIn: rememberMe ? "30d" : "1d",
    });

    return accessToken;
  }

  /**
   * Updates the display name of a user.
   * @param id The user's UUID
   * @param name The new display name
   * @returns The updated user object (without sensitive fields)
   * @throws {OperError} `U000` (`UserNotFound`) if no user exists with the given ID
   */
  async changeName(id: string, name: string) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq, and }) =>
        and(eq(user.id, id), eq(user.status, "verified")),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to change name for user with id (${id}) failed because the user does not exist.`,
      );
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: `User with id (${id}) does not exist`,
        key: "id",
        value: id,
      });
    }

    const [updatedUser] = await this.store.db
      .update(users)
      .set({ name })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phoneNumber: users.phoneNumber,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return updatedUser;
  }

  /**
   * Generates an email change OTP for the user and saves it to their record. The OTP expires in 10 minutes.
   * The caller is responsible for delivering the OTP to the user (e.g., via the new email).
   * @param id The user's UUID
   * @param newEmail The new email address the user wants to switch to
   * @returns `{ otp, user: { name, email } }` — the raw OTP and current user details for composing the email
   * @throws {OperError} `U000` (`UserNotFound`) if no user exists with the given ID
   * @throws {OperError} `U009` (`SameEmail`) if the new email is the same as the current email
   * @throws {OperError} `U005` (`EmailAlreadyRegistered`) if the new email is already taken
   */
  async requestChangeEmail(id: string, newEmail: string) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq, and }) =>
        and(eq(user.id, id), eq(user.status, "verified")),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to request an email change for user with id (${id}) failed because the user does not exist.`,
      );
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: `User with id (${id}) does not exist`,
        key: "id",
        value: id,
      });
    }

    if (newEmail === user.email) {
      logMessage(
        "info",
        `Attempt to request an email change for user with id (${id}) failed because the new email is the same as the current email.`,
      );
      throw new OperError({
        code: UserErrorCodes.SameEmail,
        message: "New email cannot be the same as your current email",
        cause: `New email (${newEmail}) is the same as the current email for user with id (${id})`,
        key: "email",
        value: newEmail,
      });
    }

    const existingUser = await this.store.db.query.users.findFirst({
      where: (u, { eq, and, ne }) => and(eq(u.email, newEmail), ne(u.id, id)),
    });

    if (existingUser) {
      logMessage(
        "info",
        `Attempt to request an email change for user with id (${id}) failed because the email (${newEmail}) is already taken.`,
      );
      throw new OperError({
        code: UserErrorCodes.EmailAlreadyRegistered,
        message: "Email is already taken",
        cause: `Email (${newEmail}) is already taken`,
        key: "email",
        value: newEmail,
      });
    }

    const otp = crypto.randomBytes(3).toHex().toUpperCase();
    await this.store.db
      .update(users)
      .set({
        emailChangeOtp: otp,
        emailChangeOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })
      .where(eq(users.id, id))
      .returning();

    return {
      otp,
      user: {
        name: user.name,
        email: user.email,
      },
    };
  }

  /**
   * Changes a user's email after verifying their OTP and current password.
   * Rotates `accessTokenId` to invalidate all existing access tokens.
   * @param id The user's UUID
   * @param otp The email change OTP previously generated by `requestChangeEmail`
   * @param newEmail The new email address to set
   * @param password The user's current password for confirmation
   * @returns The updated user object (without sensitive fields)
   * @throws {OperError} `U000` (`UserNotFound`) if no user exists with the given ID
   * @throws {OperError} `U002` (`EmailChangeOtpInvalidOrExpired`) if the OTP is missing, wrong, or has expired
   * @throws {OperError} `U006` (`WrongPassword`) if the provided password is incorrect
   * @throws {OperError} `U005` (`EmailAlreadyRegistered`) if the new email is already taken
   */
  async changeEmail(
    id: string,
    otp: string,
    newEmail: string,
    password: string,
  ) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq, and }) =>
        and(eq(user.id, id), eq(user.status, "verified")),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to change email for user with id (${id}) failed because the user does not exist.`,
      );
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: `User with id (${id}) does not exist`,
        key: "id",
        value: id,
      });
    }

    if (!user.emailChangeOtp || user.emailChangeOtp !== otp) {
      logMessage(
        "info",
        `Attempt to change email for user with id (${id}) failed because the OTP is invalid.`,
      );
      throw new OperError({
        code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
        message: "Verification code is invalid or has expired",
        cause: `Email change OTP is invalid for user with id (${id})`,
      });
    }

    if (
      user.emailChangeOtpExpiresAt &&
      user.emailChangeOtpExpiresAt < new Date()
    ) {
      await this.store.db
        .update(users)
        .set({ emailChangeOtp: null, emailChangeOtpExpiresAt: null })
        .where(eq(users.id, id));

      logMessage(
        "info",
        `Attempt to change email for user with id (${id}) failed because the OTP has been expired for ${((Date.now() - user.emailChangeOtpExpiresAt.getTime()) / 60000).toFixed(2)} minutes.`,
      );
      throw new OperError({
        code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
        message: "Verification code is invalid or has expired",
        cause: `Email change OTP for user with id (${id}) has been expired for ${((Date.now() - user.emailChangeOtpExpiresAt!.getTime()) / 60000).toFixed(2)} minutes`,
      });
    }

    if (!verifyPassword(password, user.password)) {
      logMessage(
        "info",
        `Attempt to change email for user with id (${id}) failed because the password is incorrect.`,
      );
      throw new OperError({
        code: UserErrorCodes.WrongPassword,
        message: "Password is incorrect",
        cause: `Password is incorrect for user with id (${id})`,
        key: "password",
      });
    }

    try {
      const [updatedUser] = await this.store.db
        .update(users)
        .set({
          email: newEmail,
          emailChangeOtp: null,
          emailChangeOtpExpiresAt: null,
          accessTokenId: (+user.accessTokenId + 1).toString(),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          phoneNumber: users.phoneNumber,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      return updatedUser;
    } catch (e) {
      handleError(e);
    }
  }

  /**
   * Changes a user's password after verifying their current password.
   * Rotates `accessTokenId` to invalidate all existing access tokens.
   * @param id The user's UUID
   * @param oldPassword The user's current password for verification
   * @param newPassword The new password to set (hashed before storing)
   * @throws {OperError} `U000` (`UserNotFound`) if no user exists with the given ID
   * @throws {OperError} `U007` (`WrongCurrentPassword`) if the current password is incorrect
   */
  async changePassword(id: string, oldPassword: string, newPassword: string) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq, and }) =>
        and(eq(user.id, id), eq(user.status, "verified")),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to change password for user with id (${id}) failed because the user does not exist.`,
      );
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: `User with id (${id}) does not exist`,
        key: "id",
        value: id,
      });
    }

    if (!verifyPassword(oldPassword, user.password)) {
      logMessage(
        "info",
        `Attempt to change password for user with id (${id}) failed because the old password is incorrect.`,
      );
      throw new OperError({
        code: UserErrorCodes.WrongCurrentPassword,
        message: "Invalid current password",
        cause: `Old password is incorrect for user with id (${id})`,
      });
    }

    await this.store.db
      .update(users)
      .set({
        password: hashPassword(newPassword),
        accessTokenId: (+user.accessTokenId + 1).toString(),
      })
      .where(eq(users.id, id));
  }

  /**
   * Generates a password reset token for the user and saves it to their record. The token expires in 10 minutes.
   * The caller is responsible for delivering the token to the user (e.g., as a link in an email).
   * @param email The user's email address
   * @returns `{ token, user: { name, email } }` — the raw reset token and user details for composing the email
   * @throws {OperError} `U000` (`UserNotFound`) if no user exists with the given email
   */
  async requestPasswordReset(email: string) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq, and }) =>
        and(eq(user.email, email), eq(user.status, "verified")),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to request password reset for user with email (${email}) failed because the user with this email does not exist.`,
      );
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: `User with email (${email}) does not exist`,
        key: "email",
        value: email,
      });
    }

    const resetToken = crypto.randomBytes(32).toHex();

    await this.store.db
      .update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })
      .where(eq(users.email, email));

    return {
      token: resetToken,
      user: {
        name: user.name,
        email: user.email,
      },
    };
  }

  /**
   * Resets a user's password using a valid reset token. Clears the token and rotates `accessTokenId`
   * to invalidate all existing access tokens.
   * @param token The password reset token from the reset email
   * @param newPassword The new password to set (hashed before storing)
   * @throws {OperError} `U008` (`InvalidOrExpiredResetToken`) if the token doesn't match any user or has expired
   */
  async resetPassword(token: string, newPassword: string) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq, and }) =>
        and(eq(user.passwordResetToken, token), eq(user.status, "verified")),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to reset password with the token (${token}) failed because a user with this token does not exist.`,
      );
      throw new OperError({
        code: UserErrorCodes.InvalidOrExpiredResetToken,
        message: "Password reset link is invalid or has expired",
        cause: `Password reset token (${token}) does not match any user`,
      });
    }

    if (
      user.passwordResetTokenExpiresAt &&
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      logMessage(
        "info",
        `Attempt to reset password with the token (${token}) failed because the token has been expired for ${((Date.now() - user.passwordResetTokenExpiresAt.getTime()) / 60000).toFixed(2)} minutes.`,
      );
      throw new OperError({
        code: UserErrorCodes.InvalidOrExpiredResetToken,
        message: "Password reset link is invalid or has expired",
        cause: `Password reset token for user with id (${user.id}) has been expired for ${((Date.now() - user.passwordResetTokenExpiresAt.getTime()) / 60000).toFixed(2)} minutes`,
      });
    }

    await this.store.db
      .update(users)
      .set({
        password: hashPassword(newPassword),
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        accessTokenId: (+user.accessTokenId + 1).toString(),
      })
      .where(eq(users.id, user.id));
  }
}
