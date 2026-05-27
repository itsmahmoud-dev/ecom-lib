import { expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";

const testEmail = faker.internet.email();
const testPassword = faker.internet.password();
const testFullName = faker.person.fullName();

test("Regsiter new user with an email", () => {
  const user = expect(
    store.users.registerUserWithEmail(testFullName, testEmail, testPassword),
  );

  user.resolves.toBeTrue();
});

test("Register a duplicate email", () => {
  const user = expect(
    store.users.registerUserWithEmail(testFullName, testEmail, testPassword),
  );
  user.rejects.toThrow();
  user.rejects.toMatchObject({
    code: "U603",
    message: expect.any(String),
    cause: expect.any(String),
  });
});

  if (!user) {
    console.log("no user");
    return;
  }

  const activated = await store.users.activateUser(user?.activationToken!);

  expect(activated).toBe(true);
});

test("Log user in", async () => {
  const data = await store.users.logUserIn(
    "itsmahmoud.dev@gmail.com",
    "123456789",
    false,
  );
  console.log(data);
  expect(data).toHaveProperty("token");
  expect(data).toHaveProperty("user");
  expect(data.user).toHaveProperty("id");
  expect(data.user).toHaveProperty("email");
  expect(data.user).toHaveProperty("name");
});
