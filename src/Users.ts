import { MoreThan, QueryFailedError } from "typeorm";
import crypto from "crypto";
import { sign } from "jsonwebtoken";

import { User } from "./db/User";
import { OperError } from "./lib/OperError";
import { UserErrorCodes } from "./types/error";
import { UserStatus } from "./types";

import type { Store } from "./Store";
import type { Repository } from "typeorm";
import { Address } from "./db";

export class Users<
  productFacetKeys extends string[] = string[],
  productOptionFacetKeys extends string[] = string[],
> {
  store: Store<productFacetKeys, productOptionFacetKeys>;
  repository: Repository<User>;
  addressRepository: Repository<Address>;

  constructor(store: Store<productFacetKeys, productOptionFacetKeys>) {
    this.store = store;
    this.repository = this.store.dataSource.getRepository(User);
    this.addressRepository = this.store.dataSource.getRepository(Address);
  }

  /**
   * Retrieves a user by their ID
   * @param id
   * @returns user if found, otherwise null
   */
  async findByID(id: number) {
    const user = await this.repository.findOne({
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

    if (!user) {
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: "User with specified ID does not exist",
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
      const token = crypto.randomBytes(32).toString("hex");

      await this.repository
        .create({
          name: name,
          email: email,
          password: User.hashPassword(password),
          activationToken: token,
          activationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        })
        .save();

      return token;
    } catch (err) {
      if (err instanceof QueryFailedError && err.driverError.code === "23505") {
        throw new OperError({
          code: UserErrorCodes.EmailAlreadyRegistered,
          message: "Email is already registered",
          cause:
            "User is trying to create a new account with an email registered for another account",
        });
      }
      throw err;
    }
  }

  /**
   * Activates a user account using the provided activation token.
   * @param token string
   * @throws {OperError} with code U600 if the token is invalid or expired
   */
  async activateUser(token: string) {
    const user = await this.repository.findOne({
      where: {
        activationToken: token,
        activationTokenExpiry: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new OperError({
        code: UserErrorCodes.TokenInvalidOrExpired,
        message: "Invalid or expired token",
        cause:
          "Token has expired (passed the 10 minutes mark) or does not exist in the database.",
      });
    }

    user.status = UserStatus.ACTIVE;
    user.activationToken = null;
    user.activationTokenExpiry = null;
    await user.save();
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
  ) {
    const user = await this.repository.findOneBy({ email });

    if (!user) {
      throw new OperError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        message: "Invalid email or password",
        cause:
          "The user may have mistyped their email, tried to log in instead of registering a new account, or typed in the wrong password",
      });
    }

    if (user.status === UserStatus.PENDING) {
      throw new OperError({
        code: UserErrorCodes.AccountNotVerified,
        message: "The user is awaiting activation",
        cause: "The user has not activated his account yet",
      });
    }

    if (!user.verifyPassword(password)) {
      throw new OperError({
        code: UserErrorCodes.InvalidEmailOrPassword,
        message: "Invalid email or password",
        cause:
          "The user may have mistyped their email, tried to log in instead of registering a new account, or typed in the wrong password",
      });
    }

    const token = sign({ id: user.id.toString() }, this.store.JWT_SECRET, {
      expiresIn: rememberMe ? "30d" : "1d",
      algorithm: "HS512",
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Changes the name of a user
   * @param id
   * @param name
   * @returns updated user
   * @throws {OperError} with code U604 if the user is not found
   */
  async changeName(id: number, name: string) {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: "The user with the specified ID does not exist",
      });
    }
    user.name = name;
    await user.save();
    return user;
  }

  /**
   * Requests an email change for a user by generating an OTP and saving it to the user's record.
   * @param id user id
   * @returns the generated OTP and user details
   * @throws {OperError} with code U604 if the user is not found
   */
  async requestChangeEmail(id: number) {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: "The user with the specified ID does not exist",
      });
    }

    const otp = crypto.randomBytes(3).toString("hex");

    user.emailChangeOtp = otp;
    user.emailChangeOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    return { name: user.name, email: user.email, otp };
  }

  /**
   * Changes the email of a user after verifying the OTP.
   * @param id user id
   * @param otp one-time password
   * @param newEmail new email address
   * @returns the updated user
   * @throws {OperError} with code U605 if the user is not found or the OTP is invalid or expired
   */
  async changeEmail(id: number, otp: string, newEmail: string) {
    const user = await this.repository.findOne({
      where: {
        id,
        emailChangeOtp: otp,
        emailChangeOtpExpiry: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new OperError({
        code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
        message: "OTP is invalid or expired",
        cause: "The OTP provided is either invalid or has expired",
      });
    }

    user.email = newEmail;
    user.emailChangeOtp = null;
    user.emailChangeOtpExpiry = null;
    await user.save();

    return user;
  }

  /**
   * Changes the user's password if the old password is correct.
   * @param id The user's ID.
   * @param oldPassword The user's current password.
   * @param newPassword The new password to set.
   * @throws {OperError} with code U604 if the user is not found
   * @throws {OperError} with code U606 if the old password is incorrect
   */
  async changePassword(id: number, oldPassword: string, newPassword: string) {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: "The user with the specified ID does not exist",
      });
    }

    const isPasswordValid = user.verifyPassword(oldPassword);
    if (!isPasswordValid) {
      throw new OperError({
        code: UserErrorCodes.WrongCurrentPassword,
        message: "Wrong current password",
        cause:
          "The provided password does not match the user's current password",
      });
    }

    user.password = User.hashPassword(newPassword);
    await user.save();
  }

  /**
   * Requests a password reset for the user with the specified ID.
   * @param id The user's ID.
   * @returns the generated password reset token and user details
   * @throws {OperError} with code U604 if the user is not found
   */
  async requestPasswordReset(id: number) {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: "The user with the specified ID does not exist",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = token;
    user.passwordResetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    return { name: user.name, email: user.email, token };
  }

  /**
   * Resets the user's password using the provided reset token and new password.
   * @param token The reset token.
   * @param newPassword The new password to set.
   * @throws {OperError} with code U607 if the reset token is invalid or expired
   */
  async resetPassword(token: string, newPassword: string) {
    const user = await this.repository.findOne({
      where: {
        passwordResetToken: token,
        passwordResetTokenExpiry: MoreThan(new Date()),
      },
    });
    if (!user) {
      throw new OperError({
        code: UserErrorCodes.InvalidResetToken,
        message: "Invalid reset token",
        cause: "The provided reset token is not valid",
      });
    }

    user.password = User.hashPassword(newPassword);
    user.passwordResetToken = null;
    user.passwordResetTokenExpiry = null;
    await user.save();
  }

  /**
   * Adds a new address for the user.
   * @param userId number
   * @param name string
   * @param country string
   * @param state string
   * @param city string
   * @param street string
   * @param building string
   * @param floor string?
   * @returns new address
   * @throws {OperError} with code U604 if the user is not found
   */
  async addAddress(
    userId: number,
    name: string,
    country: string,
    state: string,
    city: string,
    street: string,
    building: string,
    floor?: string,
  ) {
    const user = await this.repository.findOne({ where: { id: userId } });
    if (!user) {
      throw new OperError({
        code: UserErrorCodes.UserNotFound,
        message: "User not found",
        cause: "The user with the specified ID does not exist",
      });
    }

    const address = await this.addressRepository
      .create({
        userId,
        name,
        country,
        state,
        city,
        street,
        building,
        floor: floor ?? null,
      })
      .save();

    return address;
  }

  /**
   * Updates an existing address for the user.
   * @param addressId number
   * @param name string
   * @param country string
   * @param state string
   * @param city string
   * @param street string
   * @param building string
   * @param floor string?
   * @returns updated address
   * @throws {OperError} with code U608 if the address is not found
   */
  async updateAddress(
    addressId: number,
    name: string,
    country: string,
    state: string,
    city: string,
    street: string,
    building: string,
    floor?: string,
  ) {
    const address = await this.addressRepository.findOne({
      where: { id: addressId },
    });
    if (!address) {
      throw new OperError({
        code: UserErrorCodes.AddressNotFound,
        message: "Address not found",
        cause: "The address with the specified ID does not exist",
      });
    }

    Object.assign(address, {
      name,
      country,
      state,
      city,
      street,
      building,
      floor: floor ?? null,
    });

    await address.save();

    return address;
  }

  /**
   * Removes an address for the user.
   * @param addressId number
   * @throws {OperError} with code U608 if the address is not found
   */
  async removeAddress(addressId: number) {
    const address = await this.addressRepository.findOne({
      where: { id: addressId },
    });
    if (!address) {
      throw new OperError({
        code: UserErrorCodes.AddressNotFound,
        message: "Address not found",
        cause: "The address with the specified ID does not exist",
      });
    }

    await address.remove();
  }
}
