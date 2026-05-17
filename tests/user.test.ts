import { expect, test } from "bun:test";
import { User } from "../src/db/User";
import { store } from ".";

test("Register New User With Email", async () => {
  const user = await store.users.registerUser({
    type: "email",
    email: "itsmahmoud.dev@gmail.com",
    name: "Mahmoud Boukhary",
    password: "123456789",
  });

  expect(user).toBeInstanceOf(User);
  expect(user).toHaveProperty("email");
});
