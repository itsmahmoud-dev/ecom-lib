import crypto from "crypto";
import { sign } from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";

import { UserErrorCodes, handleError, OperationalError } from "./lib/errors";
import { addresses, users } from "./db/schema";
import { hashPassword, verifyPassword } from "./lib/string";

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
   * @throws {OperationalError} `U000` (`UserNotFound`) if no user exists with the given ID
   */
  async findByID(id: string) {
    const user = await this.store.db.query.users.findFirst({
      where: { id, status: "verified" },
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
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        severity: "warning",
        userMessage: "User was not found",
        logMessage: "Finding user failed because it does not exist",
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
   * @throws {OperationalError} `U005` (`EmailAlreadyRegistered`) if the email is already in use
   */
  async registerUser(name: string, email: string, password: string) {
    try {
      const existingUser = await this.store.db.query.users.findFirst({
        where: { email },
      });

      if (existingUser) {
        throw new OperationalError({
          code: UserErrorCodes.EmailAlreadyRegistered,
          severity: "info",
          userMessage: "Email is already in use",
          logMessage:
            "Registering user failed because the email they used is already in use",
          key: "email",
          value: email,
        });
      }

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
        throw new OperationalError({
          code: "",
          severity: "error",
          logMessage: "Error inserting a user",
          userMessage: "Something went wrong",
        });
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
   * @throws {OperationalError} `U004` (`VerificationOtpInvalidOrExpired`) if the OTP doesn't match any user or has expired
   */
  async verifyUser(otp: string) {
    const user = await this.store.db.query.users.findFirst({
      where: { verificationOtp: otp },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.VerificationOtpInvalidOrExpired,
        severity: "warning",
        userMessage: "Verification code is invalid or has expired",
        logMessage: "Verifying user failed because their otp was invalid",
        key: "verificationOtp",
        value: otp,
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

      throw new OperationalError({
        code: UserErrorCodes.VerificationOtpInvalidOrExpired,
        severity: "info",
        userMessage: "Verification code is invalid or has expired",
        logMessage: `Verifying user failed because the otp has been expired for ${((Date.now() - user.verificationOtpExpiresAt!.getTime()) / 60000).toFixed(2)} minutes`,
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
   * @throws {OperationalError} `U001` (`InvalidEmailOrPassword`) if the email doesn't exist or the password is wrong
   * @throws {OperationalError} `U003` (`AccountNotVerified`) if the user hasn't verified their account
   */
  async logUserIn(email: string, password: string, rememberMe: boolean = false) {
    const user = await this.store.db.query.users.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        severity: "info",
        userMessage: "Email or password is incorrect",
        logMessage: "Logging user in failed because their email was not found",
        key: "email",
        value: email,
      });
    }

    if (user.status !== "verified") {
      throw new OperationalError({
        code: UserErrorCodes.AccountNotVerified,
        severity: "info",
        userMessage: "Account not verified",
        logMessage: "Logging user in failed because they are not verified yet",
        key: "status",
        value: user.status,
      });
    }

    if (!verifyPassword(password, user?.password)) {
      // TODO: set rate limiter for failed retries
      throw new OperationalError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        severity: "info",
        userMessage: "Email or password is incorrect",
        logMessage: "Logging user in failed because their password is incorrect",
        key: "password",
      });
    }

    const accessToken = sign({ id: user.id }, this.store.JWT_SECRET, {
      jwtid: user.accessTokenId.toString(),
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
   * @throws {OperationalError} `U000` (`UserNotFound`) if no user exists with the given ID
   */
  async changeName(id: string, name: string) {
    const user = await this.store.db.query.users.findFirst({
      where: {
        id,
        status: "verified",
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        severity: "warning",
        userMessage: "User not found",
        logMessage: "Changing user name failed because the user does not exist",
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
   * @throws {OperationalError} `U000` (`UserNotFound`) if no user exists with the given ID
   * @throws {OperationalError} `U009` (`SameEmail`) if the new email is the same as the current email
   * @throws {OperationalError} `U005` (`EmailAlreadyRegistered`) if the new email is already taken
   */
  async requestChangeEmail(id: string, newEmail: string) {
    const existingUser = await this.store.db.query.users.findFirst({
      where: {
        email: newEmail,
        id: {
          ne: id,
        },
      },
    });

    if (existingUser) {
      throw new OperationalError({
        code: UserErrorCodes.EmailAlreadyRegistered,
        severity: "info",
        userMessage: "Email is already taken",
        logMessage:
          "Requesting to change an email for a user failed because the new email is already taken",
        key: "email",
        value: newEmail,
      });
    }

    const user = await this.store.db.query.users.findFirst({
      where: {
        id,
        status: "verified",
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        severity: "warning",
        userMessage: "User not found",
        logMessage:
          "Requesting to change an email for a user failed because the user does not exist",
        key: "id",
        value: id,
      });
    }

    if (newEmail === user.email) {
      throw new OperationalError({
        code: UserErrorCodes.SameEmail,
        severity: "info",
        userMessage: "New email cannot be the same as your current email",
        logMessage:
          "Requesting to change an email for a user failed because the new email is the same as the old one",
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
   * @throws {OperationalError} `U000` (`UserNotFound`) if no user exists with the given ID
   * @throws {OperationalError} `U002` (`EmailChangeOtpInvalidOrExpired`) if the OTP is missing, wrong, or has expired
   * @throws {OperationalError} `U006` (`WrongPassword`) if the provided password is incorrect
   * @throws {OperationalError} `U005` (`EmailAlreadyRegistered`) if the new email is already taken
   */
  async changeEmail(
    id: string,
    otp: string,
    newEmail: string,
    password: string,
  ) {
    const existingUser = await this.store.db.query.users.findFirst({
      where: {
        email: newEmail,
        id: {
          ne: id,
        },
      },
    });

    if (existingUser) {
      throw new OperationalError({
        code: UserErrorCodes.EmailAlreadyRegistered,
        severity: "info",
        userMessage: "Email is already taken",
        logMessage:
          "Changing an email for a user failed because the new email is already taken",
        key: "email",
        value: newEmail,
      });
    }

    const user = await this.store.db.query.users.findFirst({
      where: {
        id,
        status: "verified",
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        severity: "warning",
        userMessage: "User not found",
        logMessage:
          "Changing an email for a user failed because the user does not exist",
        key: "id",
        value: id,
      });
    }

    if (!user.emailChangeOtp || user.emailChangeOtp !== otp) {
      throw new OperationalError({
        code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
        severity: "info",
        userMessage: "Verification code is invalid or has expired",
        logMessage:
          "Changing an email for a user failed because the OTP is invalid",
        key: "emailChangeOtp",
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

      throw new OperationalError({
        code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
        severity: "info",
        userMessage: "Verification code is invalid or has expired",
        logMessage:
          "Changing an email for a user failed because the OTP has expired",
        key: "emailChangeOtpExpiresAt",
        value: user.emailChangeOtpExpiresAt.toString(),
      });
    }

    if (!verifyPassword(password, user.password)) {
      throw new OperationalError({
        code: UserErrorCodes.WrongPassword,
        severity: "info",
        userMessage: "Password is incorrect",
        logMessage:
          "Changing an email for a user failed because the password is incorrect",
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
          accessTokenId: sql`(${users.accessTokenId} + 1) % 1000`,
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
   * @throws {OperationalError} `U000` (`UserNotFound`) if no user exists with the given ID
   * @throws {OperationalError} `U007` (`WrongCurrentPassword`) if the current password is incorrect
   */
  async changePassword(id: string, oldPassword: string, newPassword: string) {
    const user = await this.store.db.query.users.findFirst({
      where: {
        id,
        status: "verified",
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        severity: "warning",
        userMessage: "User was not found",
        logMessage:
          "Changing user password failed because the user does not exist",
        key: "id",
        value: id,
      });
    }

    if (!verifyPassword(oldPassword, user.password)) {
      throw new OperationalError({
        code: UserErrorCodes.WrongCurrentPassword,
        severity: "info",
        userMessage: "Invalid current password",
        logMessage:
          "Changing user password failed because the old password is incorrect",
        key: "oldPassword",
      });
    }

    await this.store.db
      .update(users)
      .set({
        password: hashPassword(newPassword),
        accessTokenId: sql`(${users.accessTokenId} + 1) % 1000`,
      })
      .where(eq(users.id, id));
  }

  /**
   * Generates a password reset token for the user and saves it to their record. The token expires in 10 minutes.
   * The caller is responsible for delivering the token to the user (e.g., as a link in an email).
   * @param email The user's email address
   * @returns `{ token, user: { name, email } }` — the raw reset token and user details for composing the email
   * @throws {OperationalError} `U000` (`UserNotFound`) if no user exists with the given email
   */
  async requestPasswordReset(email: string) {
    const user = await this.store.db.query.users.findFirst({
      where: {
        email,
        status: "verified",
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        severity: "warning",
        userMessage: "User was not found",
        logMessage:
          "Requesting a password reset failed because the user does not exist",
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
   * @throws {OperationalError} `U008` (`InvalidOrExpiredResetToken`) if the token doesn't match any user or has expired
   */
  async resetPassword(token: string, newPassword: string) {
    const user = await this.store.db.query.users.findFirst({
      where: {
        passwordResetToken: token,
        status: "verified",
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.InvalidOrExpiredResetToken,
        severity: "warning",
        userMessage: "Password reset link is invalid or has expired",
        logMessage:
          "Resetting a password failed because the token does not match any user",
        key: "token",
      });
    }

    if (
      user.passwordResetTokenExpiresAt &&
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      throw new OperationalError({
        code: UserErrorCodes.InvalidOrExpiredResetToken,
        severity: "info",
        userMessage: "Password reset link is invalid or has expired",
        logMessage: "Resetting a password failed because the token has expired",
        key: "passwordResetTokenExpiresAt",
        value: user.passwordResetTokenExpiresAt.toString(),
      });
    }

    await this.store.db
      .update(users)
      .set({
        password: hashPassword(newPassword),
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        accessTokenId: sql`(${users.accessTokenId} + 1) % 1000`,
      })
      .where(eq(users.id, user.id));
  }

  async addAddress(
    userId: string,
    address: {
      name: string;
      country: string;
      state: string;
      city: string;
      street: string;
      building: string;
      floor?: string;
    },
  ) {
    try {
      const [newAddress] = await this.store.db
        .insert(addresses)
        .values({
          userId,
          name: address.name,
          country: address.country,
          state: address.state,
          city: address.city,
          street: address.street,
          building: address.building,
          floor: address.floor,
        })
        .returning();

      if (!newAddress) {
        throw new OperationalError({
          code: "",
          severity: "error",
          userMessage: "Something went wrong",
          logMessage: "Error inserting an address",
        });
      }

      return newAddress;
    } catch (e) {
      handleError(e);
    }
  }
}
