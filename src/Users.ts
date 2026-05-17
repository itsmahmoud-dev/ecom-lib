import type { Repository } from "typeorm";
import type { Store } from "./Store";
import { User } from "./db/User";
import type {
  CreateUserWithEmailProps,
  CreateUserWithPhoneNumberProps,
} from "./types/user";
import crypto from "crypto";

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

  activateUser() {}

  logUserIn() {}
}
