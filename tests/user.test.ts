import { afterAll, expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import {
  AlreadyExistsError,
  CustomError,
  CustomErrorCodes,
  NotFoundError,
} from "../src/utils/errors";
import { users } from "../src/db/schema";
import { verifyPassword, hashPassword } from "../src/utils/string";

test("Regsiter new user with an email", async () => {
  const testName = faker.person.fullName();
  const testEmail = faker.internet.email();

  const user = await store.users.registerUser({
    name: testName,
    email: testEmail,
    password: "12345678",
  });

  expect(user).toMatchObject({
    id: expect.any(String),
    verificationOtp: expect.any(String),
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

  const user = store.users.registerUser({
    name: faker.person.fullName(),
    email: userThatExists!.email,
    password: "12345678",
  });

  expect(user).rejects.toThrow(AlreadyExistsError);
});

test("Verify user", async () => {
  const user = await store.users.registerUser({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
  });

  expect(user).toBeDefined();

  const updatedUser = await store.users.verifyUser({
    otp: user.verificationOtp!,
    email: user.email,
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

  const verifiedUser = store.users.verifyUser({
    email: user!.email,
    otp: user!.verificationOtp!,
  });

  expect(verifiedUser).rejects.toThrow(CustomError);
  expect(verifiedUser).rejects.toMatchObject({
    code: CustomErrorCodes.ExpiredVerificationOtp,
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

  const result = store.users.verifyUser({ email: user!.email, otp: "WRONG1" });

  expect(result).rejects.toThrow(CustomError);
  expect(result).rejects.toMatchObject({
    code: CustomErrorCodes.InvalidVerificationOtp,
  });
});

test("Log user in with correct credentials", async () => {
  const password = faker.internet.password();

  const user = await store.users.registerUser({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password,
  });

  expect(user).toBeDefined();

  await store.users.verifyUser({
    email: user.email,
    otp: user.verificationOtp!,
  });

  const { accessToken } = await store.users.logUserIn({
    email: user.email,
    password,
  });

  expect(accessToken).toEqual(expect.any(String));
});

test("Log user in with an unregistered email", async () => {
  const user = store.users.logUserIn({
    email: faker.internet.email(),
    password: faker.internet.password(),
  });

  expect(user).rejects.toThrow(NotFoundError);
});

test("Log user in with a wrong password", async () => {
  const password = faker.internet.password();

  const user = await store.users.registerUser({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password,
  });

  expect(user).toBeDefined();

  await store.users.verifyUser({
    email: user!.email,
    otp: user.verificationOtp!,
  });

  const loggedUser = store.users.logUserIn({
    email: user!.email,
    password: faker.internet.password(),
  });

  expect(loggedUser).rejects.toThrow(CustomError);
  expect(loggedUser).rejects.toMatchObject({
    code: CustomErrorCodes.IncorrectPassword,
  });
});

test("Log in an unverified user", async () => {
  const password = faker.internet.password();
  const user = await store.users.registerUser({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password,
  });

  expect(user).toBeDefined();

  const loggedUser = store.users.logUserIn({ email: user!.email, password });

  expect(loggedUser).rejects.toThrow(CustomError);
  expect(loggedUser).rejects.toMatchObject({
    code: CustomErrorCodes.AccountNotVerified,
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
  const updatedUser = await store.users.changeName({
    id: user!.id,
    name: newName,
  });

  expect(updatedUser).toBeDefined();

  expect(updatedUser!.name).toBe(newName);
});

test("Change name of a non-existent user", async () => {
  const result = store.users.changeName({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
  });

  expect(result).rejects.toThrow(NotFoundError);
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

  const { emailChangeOtp, emailChangeOtpExpiresAt } =
    await store.users.requestChangeEmail({
      id: user!.id,
      newEmail: faker.internet.email(),
    });

  expect(emailChangeOtp).toEqual(expect.any(String));

  expect(emailChangeOtp).toBe(emailChangeOtp);
  expect(emailChangeOtpExpiresAt).toBeInstanceOf(Date);
  expect(emailChangeOtpExpiresAt!.getTime()).toBeGreaterThan(Date.now());
});

test("Request email change for a non-existent user", async () => {
  const result = store.users.requestChangeEmail({
    id: faker.string.uuid(),
    newEmail: faker.internet.email(),
  });

  expect(result).rejects.toThrow(NotFoundError);
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
  const { emailChangeOtp } = await store.users.requestChangeEmail({
    id: user!.id,
    newEmail,
  });

  const updatedUser = await store.users.changeEmail({
    id: user!.id,
    otp: emailChangeOtp!,
    newEmail,
    password,
  });

  expect(updatedUser!.email).toBe(newEmail);

  expect(updatedUser!.emailChangeOtp).toBeNull();
  expect(updatedUser!.emailChangeOtpExpiresAt).toBeNull();
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

  await store.users.requestChangeEmail({
    id: user!.id,
    newEmail: faker.internet.email(),
  });

  const result = store.users.changeEmail({
    id: user!.id,
    otp: "WRONG1",
    newEmail: faker.internet.email(),
    password,
  });

  expect(result).rejects.toThrow(CustomError);
  expect(result).rejects.toMatchObject({
    code: CustomErrorCodes.InvalidEmailChangeOtp,
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

  const result = store.users.changeEmail({
    id: user!.id,
    otp,
    newEmail: faker.internet.email(),
    password,
  });

  expect(result).rejects.toThrow(CustomError);
  expect(result).rejects.toMatchObject({
    code: CustomErrorCodes.ExpiredEmailChangeOtp,
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

  const { emailChangeOtp } = await store.users.requestChangeEmail({
    id: user!.id,
    newEmail: faker.internet.email(),
  });

  const result = store.users.changeEmail({
    id: user!.id,
    otp: emailChangeOtp!,
    newEmail: faker.internet.email(),
    password: "wrong-password",
  });

  expect(result).rejects.toThrow(CustomError);
  expect(result).rejects.toMatchObject({
    code: CustomErrorCodes.IncorrectPassword,
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

  const result = store.users.requestChangeEmail({
    id: user!.id,
    newEmail: existingUser!.email,
  });

  expect(result).rejects.toThrow(AlreadyExistsError);
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
  const updatedUser = await store.users.changePassword({
    id: user!.id,
    oldPassword: password,
    newPassword,
  });

  expect(updatedUser).toBeDefined();
  expect(verifyPassword(newPassword, updatedUser.password)).toBeTrue();
});

test("Change password for a non-existent user", async () => {
  const result = store.users.changePassword({
    id: faker.string.uuid(),
    oldPassword: faker.internet.password(),
    newPassword: faker.internet.password(),
  });

  expect(result).rejects.toThrow(NotFoundError);
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

  const result = store.users.changePassword({
    id: user!.id,
    oldPassword: "wrong-password",
    newPassword: faker.internet.password(),
  });

  expect(result).rejects.toThrow(CustomError);
  expect(result).rejects.toMatchObject({
    code: CustomErrorCodes.IncorrectPassword,
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

  const { passwordResetToken, email, name, passwordResetTokenExpiresAt } =
    await store.users.requestPasswordReset(user!.email);

  expect(passwordResetToken).toEqual(expect.any(String));
  expect(name).toBe(user!.name);
  expect(email).toBe(user!.email);

  expect(passwordResetTokenExpiresAt).toBeInstanceOf(Date);
  expect(passwordResetTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
});

test("Request password reset for a non-existent user", async () => {
  const result = store.users.requestPasswordReset(faker.internet.email());

  expect(result).rejects.toThrow(NotFoundError);
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

  const { passwordResetToken: token } = await store.users.requestPasswordReset(
    user!.email,
  );

  const newPassword = faker.internet.password();
  const { password, passwordResetToken, passwordResetTokenExpiresAt } =
    await store.users.resetPassword({
      newPassword,
      token: token!,
    });

  expect(verifyPassword(newPassword, password)).toBeTrue();
  expect(passwordResetToken).toBeNull();
  expect(passwordResetTokenExpiresAt).toBeNull();
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

  const result = store.users.resetPassword({
    token,
    newPassword: faker.internet.password(),
  });

  expect(result).rejects.toThrow(CustomError);
  expect(result).rejects.toMatchObject({
    code: CustomErrorCodes.ExpiredPasswordResetToken,
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
    floor: faker.number.int({ min: 1, max: 20 }),
  };

  const newAddress = await store.users.addAddress({ userId: user!.id, address });

  expect(newAddress).toMatchObject(address);
});

test("Add an address for a user that doesn't exist", async () => {
  const result = store.users.addAddress({
    userId: faker.string.uuid(),
    address: {
      name: faker.person.fullName(),
      country: faker.location.country(),
      state: faker.location.state(),
      city: faker.location.city(),
      street: faker.location.street(),
      building: faker.location.buildingNumber(),
    },
  });

  expect(result).rejects.toThrow(NotFoundError);
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

  const address = await store.users.addAddress({
    userId: user!.id,
    address: {
      name: faker.person.fullName(),
      country: faker.location.country(),
      state: faker.location.state(),
      city: faker.location.city(),
      street: faker.location.street(),
      building: faker.location.buildingNumber(),
    },
  });

  const newCity = faker.location.city();
  const updatedAddress = await store.users.updateAddress({
    id: address.id,
    city: newCity,
  });

  expect(updatedAddress).toMatchObject({
    id: address!.id,
    city: newCity,
  });
});

test("Update an address that doesn't exist", async () => {
  const result = store.users.updateAddress({
    id: faker.string.uuid(),
    city: faker.location.city(),
  });

  expect(result).rejects.toThrow(NotFoundError);
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

  const address = await store.users.addAddress({
    userId: user!.id,
    address: {
      name: faker.person.fullName(),
      country: faker.location.country(),
      state: faker.location.state(),
      city: faker.location.city(),
      street: faker.location.street(),
      building: faker.location.buildingNumber(),
    },
  });

  await store.users.removeAddress(address.id);

  expect(
    await store.db.query.addresses.findFirst({ where: { id: address.id } }),
  ).toBeUndefined();
});

test("Delete an address that doesn't exist", async () => {
  const result = store.users.removeAddress(faker.string.uuid());

  expect(result).rejects.toThrow(NotFoundError);
});

afterAll(async () => {
  await store.db.delete(users);
});
