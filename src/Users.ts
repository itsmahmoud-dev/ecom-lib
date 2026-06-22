import crypto from "crypto";

import { OperError } from "./lib/OperError";
import type { Store } from "./Store";
import { logMessage, UserErrorCodes } from "./lib/errors";
import { hashPassword, users } from "./models";
import { handleError } from "./lib/errors";
import { eq } from "drizzle-orm";

export class Users {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Retrieves a user by their ID
   * @param id uuid
   * @returns user if found, otherwise null
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
      where: (user, { eq }) => eq(user.id, id),
    });

    if (!user) {
      logMessage(
        "info",
        `Looking for user with id (${id}) failed becuase they are not found.`,
      );

      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: `A user with id (${id}) does not exist in database`,
        key: "id",
        value: id,
      });
    }

    return user;
  }

  /**
   * Registers a new user with the given name, email, and password.
   * @param name string
   * @param email string
   * @param password string
   * @returns activation token
   * @throws {OperError} with code U603 if the email is already in use
   */
  async registerUser(name: string, email: string, password: string) {
    try {
      const token = crypto.randomBytes(32).toHex();

      const [user] = await this.store.db
        .insert(users)
        .values({
          name,
          email,
          password: hashPassword(password),
          verificationToken: token,
          verificationTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          verificationToken: users.verificationToken,
          verificationTokenExpiresAt: users.verificationTokenExpiresAt,
        });

      return user;
    } catch (e) {
      handleError(e);
    }
  }

  /**
   * verifies a user account using the provided verification token.
   * @param token string
   * @throws {OperError} with code U600 if the token is invalid or expired
   */
  async verifyUser(token: string) {
    const user = await this.store.db.query.users.findFirst({
      where: (user, { eq }) => eq(user.verificationToken, token),
    });

    if (!user) {
      logMessage(
        "warn",
        `Attempt to verify user with token (${token}) failed, becuase the user with this verification token doesn't exist.`,
      );

      throw new OperError({
        code: UserErrorCodes.TokenInvalidOrExpired,
        message: "Verification invalid or expired",
        cause: "Token is invalid",
      });
    }

    if (
      user?.verificationTokenExpiresAt &&
      user.verificationTokenExpiresAt < new Date()
    ) {
      await this.store.db
        .update(users)
        .set({ verificationToken: null, verificationTokenExpiresAt: null })
        .where(eq(users.id, user.id));

      logMessage(
        "info",
        `Attempt to verify user with email (${user.email}) failed because the token has been expired for ${((Date.now() - user.verificationTokenExpiresAt.getTime()) / 60000).toFixed(2)} minutes.`,
      );

      throw new OperError({
        code: UserErrorCodes.TokenInvalidOrExpired,
        message: "Verification invalid or expired",
        cause: "Token is expired",
      });
    }

    await this.store.db
      .update(users)
      .set({
        verificationToken: null,
        verificationTokenExpiresAt: null,
        status: "verified",
      })
      .where(eq(users.id, user.id));
  }

  /**
   * Logs in a user using their email and password.
   * @param email string
   * @param password string
   * @param rememberMe boolean | undefined
   * @returns an object containing user data and an access token
   * @throws {OperError} with code U601 if the email is invalid or the password is incorrect
   * @throws {OperError} with code U602 if the user's account is not verified
   */
  async logUserIn(
    email: string,
    password: string,
    rememberMe: boolean = false,
  ) {}

  /**
   * Changes the name of a user
   * @param id
   * @param name
   * @returns updated user
   * @throws {OperError} with code U604 if the user is not found
   */
  async changeName(id: number, name: string) {}

  /**
   * Requests an email change for a user by generating an OTP and saving it to the user's record.
   * @param id user id
   * @returns the generated OTP and user details
   * @throws {OperError} with code U604 if the user is not found
   */
  async requestChangeEmail(id: number) {}

  /**
   * Changes the email of a user after verifying the OTP.
   * @param id user id
   * @param otp one-time password
   * @param newEmail new email address
   * @returns the updated user
   * @throws {OperError} with code U605 if the user is not found or the OTP is invalid or expired
   */
  async changeEmail(id: number, otp: string, newEmail: string) {}

  /**
   * Changes the user's password if the old password is correct.
   * @param id The user's ID.
   * @param oldPassword The user's current password.
   * @param newPassword The new password to set.
   * @throws {OperError} with code U604 if the user is not found
   * @throws {OperError} with code U606 if the old password is incorrect
   */
  async changePassword(id: number, oldPassword: string, newPassword: string) {}

  /**
   * Requests a password reset for the user with the specified ID.
   * @param id The user's ID.
   * @returns the generated password reset token and user details
   * @throws {OperError} with code U604 if the user is not found
   */
  async requestPasswordReset(id: number) {}

  /**
   * Resets the user's password using the provided reset token and new password.
   * @param token The reset token.
   * @param newPassword The new password to set.
   * @throws {OperError} with code U607 if the reset token is invalid or expired
   */
  async resetPassword(token: string, newPassword: string) {}
}
