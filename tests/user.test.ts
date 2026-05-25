import { expect, test } from "bun:test";
import { User } from "../src/db";
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

test("Activate User", async () => {
  const user = await store.users.repository.findOne({
    where: { email: "itsmahmoud.dev@gmail.com" },
  });

  if (!user) {
    console.log("no user");
    return;
  }

  const activated = await store.users.activateUser(user?.activationToken!);

  expect(activated).toBe(true);
});
