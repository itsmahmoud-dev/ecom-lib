import { expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { UserRole } from "../src/types";
import { OperError } from "../src/lib/OperError";
import { UserErrorCodes } from "../src/types/error";

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
  user.rejects.toThrow(OperError);
  user.rejects.toMatchObject({
    code: UserErrorCodes.EmailAlreadyRegistered,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Activate user", async () => {
  const user = await store.users.repository.findOneBy({ email: testEmail });

  expect(user).not.toBeNull();
  expect(user!.activationToken).not.toBeNull();
  expect(user!.activationToken).not.toBeUndefined();

  const result = expect(store.users.activateUser(user!.activationToken!));

  result.resolves.toBeTrue();
});

test("Activate user with an expired token", async () => {
  const user = await store.users.repository
    .create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      activationToken: "1234",
      activationTokenExpiry: new Date(Date.now() - 10 * 60 * 1000),
    })
    .save();

  expect(user).not.toBeNull();
  expect(user!.activationToken).not.toBeNull();
  expect(user!.activationToken).not.toBeUndefined();

  const result = expect(store.users.activateUser(user!.activationToken!));

  result.rejects.toThrow(OperError);
  result.rejects.toMatchObject({
    code: UserErrorCodes.TokenInvalidOrExpired,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Log user in", async () => {
  const data = await store.users.logUserIn(testEmail, testPassword, false);

  expect(data).toMatchObject({
    token: expect.any(String),
    user: {
      id: expect.any(Number),
      name: expect.any(String),
      email: expect.any(String),
    },
  });

  expect(Object.values(UserRole)).toContain(data.user.role);
});

test("Log user in with an unregistered email", async () => {
  const data = expect(
    store.users.logUserIn(faker.internet.email(), faker.internet.password()),
  );

  data.rejects.toThrow(OperError);
  data.rejects.toMatchObject({
    code: UserErrorCodes.InvalidEmailOrPassword,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Log user in with a wrong password", async () => {
  const data = expect(
    store.users.logUserIn(testEmail, faker.internet.password()),
  );

  data.rejects.toThrow(OperError);
  data.rejects.toMatchObject({
    code: UserErrorCodes.InvalidEmailOrPassword,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Log in a pending user", async () => {
  const testPassword2 = faker.internet.password();
  const user = await store.users.repository
    .create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: testPassword2,
    })
    .save();

  expect(user).not.toBeNull();

  const result = expect(store.users.logUserIn(user.email!, testPassword2));

  result.rejects.toThrow(OperError);
  result.rejects.toMatchObject({
    code: UserErrorCodes.AccountNotVerified,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Get user by id", async () => {
  const [user] = await store.users.repository.find({ take: 1 });

  expect(user).not.toBeNull();

  const userById = await store.users.getUserById(user!.id);
  expect(userById).not.toBeNull();
  expect(userById).toMatchObject({
    id: user!.id,
    name: user!.name,
    email: user!.email,
    phoneNumber: user!.phoneNumber,
    role: user!.role,
    status: user!.status,
    createdAt: user!.createdAt,
    updatedAt: user!.updatedAt,
  });

  expect(userById?.password).toBeUndefined();
  expect(userById?.activationToken).toBeUndefined();
  expect(userById?.activationTokenExpiry).toBeUndefined();
  expect(userById?.passwordResetToken).toBeUndefined();
  expect(userById?.passwordResetTokenExpiry).toBeUndefined();
});

test("Get user by id - not found", async () => {
  const userById = store.users.getUserById(-1);
  expect(userById).rejects.toThrow(OperError);
  expect(userById).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Change user name", async () => {
  const user = await store.users.repository
    .create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    })
    .save();

  const newName = faker.person.fullName();
  const updatedUser = await store.users.changeName(user.id, newName);

  expect(updatedUser.name).toBe(newName);
});
