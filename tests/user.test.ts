import { expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { OperError } from "../src/lib/OperError";
import { UserErrorCodes } from "../src/lib/errors";
import { users } from "../src/models";

test("Get user by id", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "1234",
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

  expect(userById).rejects.toThrow(OperError);
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
    name: testName,
    email: testEmail,
    verificationToken: expect.any(String),
    verificationTokenExpiresAt: expect.any(Date),
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

  const result = expect(
    store.users.registerUser(
      faker.person.fullName(),
      userThatExists!.email,
      "1234",
    ),
  );

  result.rejects.toThrow(OperError);
  result.rejects.toMatchObject({
    code: UserErrorCodes.EmailAlreadyRegistered,
    message: expect.any(String),
  });
});

test("Activate user", async () => {
  const user = await store.users.registerUser(
    faker.person.fullName(),
    faker.internet.email(),
    faker.internet.password(),
  );

  expect(user).toBeDefined();

  await store.users.verifyUser(user!.verificationToken!);

  const updatedUser = await store.db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, user!.id),
  });

  expect(updatedUser).toBeDefined();

  expect(updatedUser!.status).toBe("verified");
  expect(updatedUser!.verificationToken).toBeNull();
  expect(updatedUser!.verificationTokenExpiresAt).toBeNull();
});

test("Activate user with an expired token", async () => {
  const [user] = await store.db
    .insert(users)
    .values({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      verificationToken: "1234",
      verificationTokenExpiresAt: new Date(Date.now() - 10 * 60 * 1000),
    })
    .returning();

  expect(user).toBeDefined();
  expect(user!.verificationToken).not.toBeNull();
  expect(user!.verificationTokenExpiresAt).not.toBeNull();

  const result = expect(store.users.verifyUser(user!.verificationToken!));

  result.rejects.toThrow(OperError);
  result.rejects.toMatchObject({
    code: UserErrorCodes.TokenInvalidOrExpired,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

// test("Log user in", async () => {
//   const data = await store.users.logUserIn(testEmail, testPassword, false);

//   expect(data).toMatchObject({
//     token: expect.any(String),
//     user: {
//       id: expect.any(Number),
//       name: expect.any(String),
//       email: expect.any(String),
//     },
//   });

//   expect(Object.values(UserRole)).toContain(data.user.role);
// });

// test("Log user in with an unregistered email", async () => {
//   const data = expect(
//     store.users.logUserIn(faker.internet.email(), faker.internet.password()),
//   );

//   data.rejects.toThrow(OperError);
//   data.rejects.toMatchObject({
//     code: UserErrorCodes.InvalidEmailOrPassword,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Log user in with a wrong password", async () => {
//   const data = expect(
//     store.users.logUserIn(testEmail, faker.internet.password()),
//   );

//   data.rejects.toThrow(OperError);
//   data.rejects.toMatchObject({
//     code: UserErrorCodes.InvalidEmailOrPassword,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Log in a pending user", async () => {
//   const testPassword2 = faker.internet.password();
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: testPassword2,
//     }),
//   );

//   expect(user).not.toBeNull();

//   const result = expect(store.users.logUserIn(user.email!, testPassword2));

//   result.rejects.toThrow(OperError);
//   result.rejects.toMatchObject({
//     code: UserErrorCodes.AccountNotVerified,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Change user name", async () => {
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: faker.internet.password(),
//     }),
//   );

//   const newName = faker.person.fullName();
//   const updatedUser = await store.users.changeName(user.id, newName);

//   expect(updatedUser.name).toBe(newName);
// });

// test("Change name of a non-existent user", async () => {
//   const result = store.users.changeName(-1, faker.person.fullName());
//   expect(result).rejects.toThrow(OperError);
//   expect(result).rejects.toMatchObject({
//     code: UserErrorCodes.UserNotFound,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Request email change", async () => {
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: faker.internet.password(),
//     }),
//   );

//   const { otp } = await store.users.requestChangeEmail(user.id);

//   const updatedUser = await store.users.repository.findOneBy({ id: user.id });

//   expect(updatedUser!.emailChangeOtp).toBe(otp);
//   expect(updatedUser!.emailChangeOtpExpiry).toBeInstanceOf(Date);
//   expect(updatedUser!.emailChangeOtpExpiry!.getTime()).toBeGreaterThan(
//     Date.now(),
//   );
// });

// test("Request email change for a non-existent user", async () => {
//   const result = store.users.requestChangeEmail(-1);
//   expect(result).rejects.toThrow(OperError);
//   expect(result).rejects.toMatchObject({
//     code: UserErrorCodes.UserNotFound,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Change email", async () => {
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: faker.internet.password(),
//     }),
//   );

//   const { otp } = await store.users.requestChangeEmail(user.id);
//   const newEmail = faker.internet.email();
//   await store.users.changeEmail(user.id, otp, newEmail);

//   const updatedUser = await store.users.repository.findOneBy({ id: user.id });

//   expect(updatedUser!.email).toBe(newEmail);
//   expect(updatedUser!.emailChangeOtp).toBeNull();
//   expect(updatedUser!.emailChangeOtpExpiry).toBeNull();
// });

// test("Change email with wrong OTP", async () => {
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: faker.internet.password(),
//     }),
//   );

//   await store.users.requestChangeEmail(user.id);
//   const result = store.users.changeEmail(
//     user.id,
//     "wrong-otp",
//     faker.internet.email(),
//   );

//   expect(result).rejects.toThrow(OperError);
//   expect(result).rejects.toMatchObject({
//     code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Change password", async () => {
//   const password = faker.internet.password();
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: User.hashPassword(password),
//     }),
//   );

//   const newPassword = faker.internet.password();
//   await store.users.changePassword(user.id, password, newPassword);

//   const updatedUser = await store.users.repository.findOneBy({ id: user.id });
//   expect(updatedUser!.verifyPassword(newPassword)).toBeTrue();
// });

// test("Change password with wrong current password", async () => {
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: User.hashPassword(faker.internet.password()),
//     }),
//   );

//   const result = store.users.changePassword(
//     user.id,
//     "wrong-password",
//     faker.internet.password(),
//   );

//   expect(result).rejects.toThrow(OperError);
//   expect(result).rejects.toMatchObject({
//     code: UserErrorCodes.WrongCurrentPassword,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Request password reset", async () => {
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: faker.internet.password(),
//     }),
//   );

//   const { token } = await store.users.requestPasswordReset(user.id);

//   const updatedUser = await store.users.repository.findOneBy({ id: user.id });

//   expect(updatedUser!.passwordResetToken).toBe(token);
//   expect(updatedUser!.passwordResetTokenExpiry).toBeInstanceOf(Date);
//   expect(updatedUser!.passwordResetTokenExpiry!.getTime()).toBeGreaterThan(
//     Date.now(),
//   );
// });

// test("Request password reset for a non-existent user", async () => {
//   const result = store.users.requestPasswordReset(-1);
//   expect(result).rejects.toThrow(OperError);
//   expect(result).rejects.toMatchObject({
//     code: UserErrorCodes.UserNotFound,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });

// test("Reset password", async () => {
//   const user = await store.users.repository.save(
//     store.users.repository.create({
//       name: faker.person.fullName(),
//       email: faker.internet.email(),
//       password: faker.internet.password(),
//     }),
//   );

//   const { token } = await store.users.requestPasswordReset(user.id);
//   const newPassword = faker.internet.password();
//   await store.users.resetPassword(token, newPassword);

//   const updatedUser = await store.users.repository.findOneBy({ id: user.id });

//   expect(updatedUser!.verifyPassword(newPassword)).toBeTrue();
//   expect(updatedUser!.passwordResetToken).toBeNull();
//   expect(updatedUser!.passwordResetTokenExpiry).toBeNull();
// });

// test("Reset password with an invalid token", async () => {
//   const result = store.users.resetPassword(
//     "invalid-token",
//     faker.internet.password(),
//   );
//   expect(result).rejects.toThrow(OperError);
//   expect(result).rejects.toMatchObject({
//     code: UserErrorCodes.InvalidResetToken,
//     message: expect.any(String),
//     cause: expect.any(String),
//   });
// });
