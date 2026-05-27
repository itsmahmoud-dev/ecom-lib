import { expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";

const testEmail = faker.internet.email();
const testPassword = faker.internet.password();
const testFullName = faker.person.fullName();

test("Regsiter New User with Email", async () => {
  const user = expect(
    store.users.registerUserWithEmail(testFullName, testEmail, testPassword),
  );

  user.resolves.toBeTrue();
});

test("Register a Duplicate Email", async () => {
  const user = expect(
    store.users.registerUserWithEmail(testFullName, testEmail, testPassword),
  );
  user.rejects.toThrow();
  user.rejects.toMatchObject({
    code: "603",
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
