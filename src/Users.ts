import { MoreThan, QueryFailedError } from "typeorm";
import crypto from "crypto";
import { sign } from "jsonwebtoken";

import { User } from "./db/User";
import { OperError } from "./lib/OperError";
import { UserErrorCodes } from "./types/error";
import { UserStatus } from "./types";

import type { Store } from "./Store";
import type { Repository } from "typeorm";

export class Users<
  productFacetKeys extends string[] = string[],
  productOptionFacetKeys extends string[] = string[],
> {
  store: Store<productFacetKeys, productOptionFacetKeys>;
  repository: Repository<User>;

  constructor(store: Store<productFacetKeys, productOptionFacetKeys>) {
    this.store = store;
    this.repository = this.store.dataSource.getRepository(User);
  }

  /**
   * @param name string
   * @param email string
   * @param password string
   * @returns true if the registering was successful
   */
  async registerUserWithEmail(name: string, email: string, password: string) {
    const token = crypto.randomBytes(32).toString("hex");

    const user = this.repository.create({
      name: name,
      email: email,
      password: await User.hashPassword(password),
      activationToken: token,
      activationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    try {
      await user.save();
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

    //TODO: SEND EMAIL TO USER FOR ACTIVATION

    return true;
  }

  /**
   * @param token string
   * @returns true if the activation was successful
   * @throws if the activation failed
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

    return true;
  }

  // FIX ME: INTEGRATE REFRESH TOKENS SUPPORT
  /**
    @param email string
    @param password string
    @param rememberMe boolean?
    @returns an object containing user data and token to be sent as a cookie
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

    if (!(await user.verifyPassword(password))) {
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
   * Retrieves a user by their ID
   * @param id
   * @returns user if found
   * @throws if user not found
   */
  async getUserById(id: number) {
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
        cause: "The user with the specified ID does not exist",
      });
    }

    return user;
  }

  /**
   * Changes the name of a user
   * @param id
   * @param name
   * @returns updated user
   * @throws if user not found
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
   * @returns the generated OTP
   * @throws if the user is not found
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

    return otp;
  }

  /**
   * Changes the email of a user after verifying the OTP.
   * @param id user id
   * @param otp one-time password
   * @param newEmail new email address
   * @throws if the user is not found or the OTP is invalid or expired
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
  }
}
