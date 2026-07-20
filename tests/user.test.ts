import { afterAll, expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { OperationalError } from "../src/lib/errors";
import { UserErrorCodes } from "../src/lib/errors";
import { users } from "../src/db/schema";
import { verifyPassword, hashPassword } from "../src/lib/string";

test("Get user by id", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
      status: "verified",
    })
    .returning();

  expect(user).not.toBeNull();

  const userById = await store.users.findByID(user!.id);

  expect(userById).not.toBeNull();

  expect(userById).toEqual({
    id: user!.id,
    name: user!.name,
    email: user!.email,
    phoneNumber: user!.phoneNumber,
    role: user!.role,
    status: user!.status,
    createdAt: user!.createdAt,
    updatedAt: user!.updatedAt,
  });
});

test("Get user that doesn't exist by id", async () => {
  const userById = store.users.findByID(faker.string.uuid());

  expect(userById).rejects.toThrow(OperationalError);
  expect(userById).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
    message: expect.any(String),
  });
});

test("Regsiter new user with an email", async () => {
  const testName = faker.person.fullName();
  const testEmail = faker.internet.email();

  const user = await store.users.registerUser(testName, testEmail, "1234");

  expect(user).toMatchObject({
    id: expect.any(String),
    otp: expect.any(String),
    name: testName,
    email: testEmail,
  });
});

test("Register a duplicate email", async () => {
  const [userThatExists] = await store.db
    .insert(users)
    .values({
      email: faker.internet.email(),
      name: faker.person.fullName(),
      password: "1234",
    })
    .returning();

  expect(userThatExists).toBeDefined();

  const user = store.users.registerUser(
    faker.person.fullName(),
    userThatExists!.email,
    "1234",
  );

  expect(user).rejects.toThrow(OperationalError);
  expect(user).rejects.toMatchObject({
    code: UserErrorCodes.EmailAlreadyRegistered,
    message: expect.any(String),
  });
});

test("Verify user", async () => {
  const user = await store.users.registerUser(
    faker.person.fullName(),
    faker.internet.email(),
    faker.internet.password(),
  );

  expect(user).toBeDefined();

  await store.users.verifyUser(user!.otp);

  const updatedUser = await store.db.query.users.findFirst({
    where: {
      id: user.id!,
    },
  });

  expect(updatedUser).toBeDefined();

  expect(updatedUser!.status).toBe("verified");
  expect(updatedUser!.verificationOtp).toBeNull();
  expect(updatedUser!.verificationOtpExpiresAt).toBeNull();
});

test("Verify user with an expired token", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      verificationOtp: "1234",
      verificationOtpExpiresAt: new Date(Date.now() - 10 * 60 * 1000),
    })
    .returning();

  expect(user).toBeDefined();
  expect(user!.verificationOtp).not.toBeNull();
  expect(user!.verificationOtpExpiresAt).not.toBeNull();

  const verifiedUser = store.users.verifyUser(user!.verificationOtp!);

  expect(verifiedUser).rejects.toThrow(OperationalError);
  expect(verifiedUser).rejects.toMatchObject({
    code: UserErrorCodes.VerificationOtpInvalidOrExpired,
  });
});

test("Verify user with an invalid OTP", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      verificationOtp: "1234",
      verificationOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    .returning();

  expect(user).toBeDefined();

  const result = store.users.verifyUser("WRONG1");

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.VerificationOtpInvalidOrExpired,
  });
});

test("Log user in with correct credentials", async () => {
  const password = faker.internet.password();

  const user = await store.users.registerUser(
    faker.person.fullName(),
    faker.internet.email(),
    password,
  );

  expect(user).toBeDefined();

  await store.users.verifyUser(user!.otp!);

  const token = await store.users.logUserIn(user!.email, password);

  expect(token).toEqual(expect.any(String));
});

test("Log user in with an unregistered email", async () => {
  const user = store.users.logUserIn(
    faker.internet.email(),
    faker.internet.password(),
  );

  expect(user).rejects.toThrow(OperationalError);
  expect(user).rejects.toMatchObject({
    code: UserErrorCodes.InvalidEmailOrPassword,
  });
});

test("Log user in with a wrong password", async () => {
  const password = faker.internet.password();

  const user = await store.users.registerUser(
    faker.person.fullName(),
    faker.internet.email(),
    password,
  );

  expect(user).toBeDefined();

  await store.users.verifyUser(user!.otp!);

  const loggedUser = store.users.logUserIn(
    user!.email,
    faker.internet.password(),
  );

  expect(loggedUser).rejects.toThrow(OperationalError);
  expect(loggedUser).rejects.toMatchObject({
    code: UserErrorCodes.InvalidEmailOrPassword,
  });
});

test("Log in an unverified user", async () => {
  const password = faker.internet.password();
  const user = await store.users.registerUser(
    faker.person.fullName(),
    faker.internet.email(),
    password,
  );

  expect(user).toBeDefined();

  const loggedUser = store.users.logUserIn(user!.email, password);

  expect(loggedUser).rejects.toThrow(OperationalError);
  expect(loggedUser).rejects.toMatchObject({
    code: UserErrorCodes.AccountNotVerified,
  });
});

test("Change user name", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const newName = faker.person.fullName();
  const updatedUser = await store.users.changeName(user!.id, newName);

  expect(updatedUser).toBeDefined();

  expect(updatedUser!.name).toBe(newName);
});

test("Change name of a non-existent user", async () => {
  const result = store.users.changeName(
    faker.string.uuid(),
    faker.person.fullName(),
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
  });
});

test("Request email change", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const { otp } = await store.users.requestChangeEmail(
    user!.id,
    faker.internet.email(),
  );

  expect(otp).toEqual(expect.any(String));

  const dbUser = await store.db.query.users.findFirst({
    where: {
      id: user!.id,
    },
  });

  expect(dbUser!.emailChangeOtp).toBe(otp);
  expect(dbUser!.emailChangeOtpExpiresAt).toBeInstanceOf(Date);
  expect(dbUser!.emailChangeOtpExpiresAt!.getTime()).toBeGreaterThan(Date.now());
});

test("Request email change for a non-existent user", async () => {
  const result = store.users.requestChangeEmail(
    faker.string.uuid(),
    faker.internet.email(),
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
  });
});

test("Change email", async () => {
  const password = faker.internet.password();
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(password),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const newEmail = faker.internet.email();
  const { otp } = await store.users.requestChangeEmail(user!.id, newEmail);
  const updatedUser = await store.users.changeEmail(
    user!.id,
    otp,
    newEmail,
    password,
  );

  expect(updatedUser!.email).toBe(newEmail);

  const dbUser = await store.db.query.users.findFirst({
    where: {
      id: user!.id,
    },
  });

  expect(dbUser!.emailChangeOtp).toBeNull();
  expect(dbUser!.emailChangeOtpExpiresAt).toBeNull();
});

test("Change email with wrong OTP", async () => {
  const password = faker.internet.password();
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(password),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  await store.users.requestChangeEmail(user!.id, faker.internet.email());

  const result = store.users.changeEmail(
    user!.id,
    "WRONG1",
    faker.internet.email(),
    password,
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
  });
});

test("Change email with expired OTP", async () => {
  const password = faker.internet.password();
  const otp = "ABCDEF";
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(password),
      emailChangeOtp: otp,
      emailChangeOtpExpiresAt: new Date(Date.now() - 10 * 60 * 1000),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const result = store.users.changeEmail(
    user!.id,
    otp,
    faker.internet.email(),
    password,
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
  });

  const dbUser = await store.db.query.users.findFirst({
    where: {
      id: user!.id,
    },
  });

  expect(dbUser!.emailChangeOtp).toBeNull();
  expect(dbUser!.emailChangeOtpExpiresAt).toBeNull();
});

test("Change email with wrong password", async () => {
  const password = faker.internet.password();
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(password),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const { otp } = await store.users.requestChangeEmail(
    user!.id,
    faker.internet.email(),
  );

  const result = store.users.changeEmail(
    user!.id,
    otp,
    faker.internet.email(),
    "wrong-password",
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.WrongPassword,
  });
});

test("Change email to an already registered email", async () => {
  const password = faker.internet.password();

  const [[existingUser], [user]] = await Promise.all([
    store.db
      .insert(users)
      .values({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: "1234",
        status: "verified",
      })
      .returning(),
    store.db
      .insert(users)
      .values({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: hashPassword(password),
        status: "verified",
      })
      .returning(),
  ]);

  expect(existingUser).toBeDefined();
  expect(user).toBeDefined();

  const result = store.users.requestChangeEmail(user!.id, existingUser!.email);

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.EmailAlreadyRegistered,
  });
});

test("Change password", async () => {
  const password = faker.internet.password();
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(password),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const newPassword = faker.internet.password();
  await store.users.changePassword(user!.id, password, newPassword);

  const dbUser = await store.db.query.users.findFirst({
    where: { id: user!.id },
  });

  expect(dbUser).toBeDefined();
  expect(verifyPassword(newPassword, dbUser!.password)).toBeTrue();
});

test("Change password for a non-existent user", async () => {
  const result = store.users.changePassword(
    faker.string.uuid(),
    faker.internet.password(),
    faker.internet.password(),
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
  });
});

test("Change password with wrong current password", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(faker.internet.password()),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const result = store.users.changePassword(
    user!.id,
    "wrong-password",
    faker.internet.password(),
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.WrongCurrentPassword,
  });
});

test("Request password reset", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(faker.internet.password()),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const { token, user: resetUser } = await store.users.requestPasswordReset(
    user!.email,
  );

  expect(token).toEqual(expect.any(String));
  expect(resetUser.name).toBe(user!.name);
  expect(resetUser.email).toBe(user!.email);

  const dbUser = await store.db.query.users.findFirst({
    where: { id: user!.id },
  });

  expect(dbUser!.passwordResetToken).toBe(token);
  expect(dbUser!.passwordResetTokenExpiresAt).toBeInstanceOf(Date);
  expect(dbUser!.passwordResetTokenExpiresAt!.getTime()).toBeGreaterThan(
    Date.now(),
  );
});

test("Request password reset for a non-existent user", async () => {
  const result = store.users.requestPasswordReset(faker.internet.email());

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
  });
});

test("Reset password", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(faker.internet.password()),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const { token } = await store.users.requestPasswordReset(user!.email);

  const newPassword = faker.internet.password();
  await store.users.resetPassword(token, newPassword);

  const dbUser = await store.db.query.users.findFirst({
    where: {
      id: user!.id,
    },
  });

  expect(dbUser).toBeDefined();
  expect(verifyPassword(newPassword, dbUser!.password)).toBeTrue();
  expect(dbUser!.passwordResetToken).toBeNull();
  expect(dbUser!.passwordResetTokenExpiresAt).toBeNull();
});

test("Reset password with an invalid token", async () => {
  const result = store.users.resetPassword(
    "invalid-token",
    faker.internet.password(),
  );

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.InvalidOrExpiredResetToken,
  });
});

test("Reset password with an expired token", async () => {
  const token = "expired-reset-token-xyz";
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: hashPassword(faker.internet.password()),
      passwordResetToken: token,
      passwordResetTokenExpiresAt: new Date(Date.now() - 10 * 60 * 1000),
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const result = store.users.resetPassword(token, faker.internet.password());

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.InvalidOrExpiredResetToken,
  });
});

test("Add an address", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const address = {
    name: faker.person.fullName(),
    country: faker.location.country(),
    state: faker.location.state(),
    city: faker.location.city(),
    street: faker.location.street(),
    building: faker.location.buildingNumber(),
    floor: faker.number.int({ min: 1, max: 20 }).toString(),
  };

  const newAddress = await store.users.addAddress(user!.id, address);

  expect(newAddress).toMatchObject(address);
});

test("Add an address for a user that doesn't exist", async () => {
  const result = store.users.addAddress(faker.string.uuid(), {
    name: faker.person.fullName(),
    country: faker.location.country(),
    state: faker.location.state(),
    city: faker.location.city(),
    street: faker.location.street(),
    building: faker.location.buildingNumber(),
  });

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
  });
});

test("Update an address", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const address = await store.users.addAddress(user!.id, {
    name: faker.person.fullName(),
    country: faker.location.country(),
    state: faker.location.state(),
    city: faker.location.city(),
    street: faker.location.street(),
    building: faker.location.buildingNumber(),
  });

  const newCity = faker.location.city();
  const updatedAddress = await store.users.updateAddress(address!.id, {
    city: newCity,
  });

  expect(updatedAddress).toMatchObject({
    id: address!.id,
    city: newCity,
  });
});

test("Update an address that doesn't exist", async () => {
  const result = store.users.updateAddress(faker.string.uuid(), {
    city: faker.location.city(),
  });

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.AddressNoFound,
  });
});

test("Delete an address", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
      status: "verified",
    })
    .returning();

  expect(user).toBeDefined();

  const address = await store.users.addAddress(user!.id, {
    name: faker.person.fullName(),
    country: faker.location.country(),
    state: faker.location.state(),
    city: faker.location.city(),
    street: faker.location.street(),
    building: faker.location.buildingNumber(),
  });

  const deletedId = await store.users.deleteAddress(address!.id);

  expect(deletedId).toBe(address!.id);
});

test("Delete an address that doesn't exist", async () => {
  const result = store.users.deleteAddress(faker.string.uuid());

  expect(result).rejects.toThrow(OperationalError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.AddressNoFound,
  });
});

afterAll(async () => {
  await store.db.delete(users);
});
