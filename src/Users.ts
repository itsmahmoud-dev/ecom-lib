import { MoreThan, QueryFailedError, type Repository } from "typeorm";
import crypto from "crypto";
import { sign } from "jsonwebtoken";

import { User } from "./db/User";
import { OperError } from "./lib/OperError";

import { UserStatus } from "./types";
import type { Store } from "./Store";

export class Users {
  store: Store;
  repository: Repository<User>;

  constructor(store: Store) {
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
      if (err instanceof QueryFailedError && err.driverError.code === "23505")
        throw new OperError({
          code: "U603",
          message: "Email is already registered",
          cause:
            "User is trying to create a new account with an email registered for another account",
        });
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
        code: "U600",
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
        code: "U601",
        message: "Invalid email or password",
        cause:
          "The user may have mistyped their email, tried to log in instead of registering a new account, or typed in the wrong password",
      });
    }

    if (user.status === UserStatus.PENDING) {
      throw new OperError({
        code: "U602",
        message: "The user is awaiting activation",
        cause: "The user has not activated his account yet",
      });
    }

    if (!(await user.verifyPassword(password))) {
      throw new OperError({
        code: "U601",
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
}
