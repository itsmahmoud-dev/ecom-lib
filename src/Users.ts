import { MoreThan, type Repository } from "typeorm";
import type { Store } from "./Store";
import { User } from "./db/User";
import crypto from "crypto";
import { OperError } from "./lib/OperError";
import {
  UserStatus,
  type CreateUserWithEmailProps,
  type CreateUserWithPhoneNumberProps,
} from "./types";

export class Users {
  store: Store;
  repository: Repository<User>;

  constructor(store: Store) {
    this.store = store;
    this.repository = this.store.dataSource.getRepository(User);
  }

  async registerUser(
    props: CreateUserWithEmailProps | CreateUserWithPhoneNumberProps,
  ) {
    const token = crypto.randomBytes(32).toString("hex");

    if (props.type === "email") {
      const user = await this.repository
        .create({
          name: props.name,
          email: props.email,
          password: await User.hashPassword(props.password),
          activationToken: token,
          activationTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        })
        .save();

      //TODO: SEND EMAIL TO USER FOR ACTIVATION

      return user;
    }
  }

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

  logUserIn() {}
}
