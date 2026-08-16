import crypto from "crypto";
import { sign } from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";

import { UserErrorCodes, handleError, OperationalError } from "./utils/errors";
import { addresses, users } from "./db/schema";
import { hashPassword, verifyPassword } from "./utils/string";

import type { Store } from "./Store";

export class Users {
  store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async registerUser(name: string, email: string, password: string) {
    try {
      const existingUser = await this.store.db.query.users.findFirst({
        where: { email },
      });

      if (existingUser) {
        throw new OperationalError({
          code: UserErrorCodes.EmailAlreadyRegistered,
          message:
            "Registering user failed because the email they used is already in use",
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
        throw new Error("Error inserting a user");
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

  async verifyUser(otp: string) {
    const user = await this.store.db.query.users.findFirst({
      where: { verificationOtp: otp },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.VerificationOtpInvalidOrExpired,
        message: "Verifying user failed because their otp was invalid",
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
        message: `Verifying user failed because the otp has been expired for ${((Date.now() - user.verificationOtpExpiresAt!.getTime()) / 60000).toFixed(2)} minutes`,
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

  async logUserIn(email: string, password: string, rememberMe: boolean = false) {
    const user = await this.store.db.query.users.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      throw new OperationalError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        message: "Logging user in failed because their email was not found",
      });
    }

    if (user.status !== "verified") {
      throw new OperationalError({
        code: UserErrorCodes.AccountNotVerified,
        message: "Logging user in failed because they are not verified yet",
      });
    }

    if (!verifyPassword(password, user?.password)) {
      throw new OperationalError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        message: "Logging user in failed because their password is incorrect",
      });
    }

    const accessToken = sign({ id: user.id }, this.store.JWT_SECRET, {
      jwtid: user.accessTokenId.toString(),
      algorithm: "HS512",
      expiresIn: rememberMe ? "30d" : "1d",
    });

    return accessToken;
  }

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
        message: "Changing user name failed because the user does not exist",
      });
    }

    await this.store.db.update(users).set({ name }).where(eq(users.id, id));
  }

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
        message:
          "Requesting to change an email for a user failed because the new email is already taken",
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
        message:
          "Requesting to change an email for a user failed because the user does not exist",
      });
    }

    if (newEmail === user.email) {
      throw new OperationalError({
        code: UserErrorCodes.SameEmail,
        message:
          "Requesting to change an email for a user failed because the new email is the same as the old one",
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
        message:
          "Changing an email for a user failed because the new email is already taken",
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
        message:
          "Changing an email for a user failed because the user does not exist",
      });
    }

    if (!user.emailChangeOtp || user.emailChangeOtp !== otp) {
      throw new OperationalError({
        code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
        message:
          "Changing an email for a user failed because the OTP is invalid",
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
        message:
          "Changing an email for a user failed because the OTP has expired",
      });
    }

    if (!verifyPassword(password, user.password)) {
      throw new OperationalError({
        code: UserErrorCodes.WrongPassword,
        message:
          "Changing an email for a user failed because the password is incorrect",
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
        message: "Changing user password failed because the user does not exist",
      });
    }

    if (!verifyPassword(oldPassword, user.password)) {
      throw new OperationalError({
        code: UserErrorCodes.WrongCurrentPassword,
        message:
          "Changing user password failed because the old password is incorrect",
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
        message:
          "Requesting a password reset failed because the user does not exist",
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
        message:
          "Resetting a password failed because the token does not match any user",
      });
    }

    if (
      user.passwordResetTokenExpiresAt &&
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      throw new OperationalError({
        code: UserErrorCodes.InvalidOrExpiredResetToken,
        message: "Resetting a password failed because the token has expired",
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
          ...address,
        })
        .returning();

      if (!newAddress) {
        throw new Error("Error inserting an address");
      }

      return newAddress;
    } catch (e) {
      handleError(e);
    }
  }

  async updateAddress(
    id: string,
    address: {
      name?: string;
      country?: string;
      state?: string;
      city?: string;
      street?: string;
      building?: string;
      floor?: string;
    },
  ) {
    const [updatedAddress] = await this.store.db
      .update(addresses)
      .set({ ...address })
      .where(eq(addresses.id, id))
      .returning();

    if (!updatedAddress) {
      throw new OperationalError({
        code: UserErrorCodes.AddressNoFound,
        message: "Updating address failed because it does not exist",
      });
    }

    return updatedAddress;
  }

  async deleteAddress(id: string) {
    const [address] = await this.store.db
      .delete(addresses)
      .where(eq(addresses.id, id))
      .returning();

    if (!address) {
      throw new OperationalError({
        code: UserErrorCodes.AddressNoFound,
        message: "Deleting address failed because it does not exist",
      });
    }

    return address.id;
  }
}
