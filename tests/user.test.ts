import { expect, test } from "bun:test";
import { store } from ".";
import { faker } from "@faker-js/faker";
import { UserRole } from "../src/types";
import { OperError } from "../src/lib/OperError";
import { UserErrorCodes } from "../src/types/error";
import { User } from "../src/db/User";

const testEmail = faker.internet.email();
const testPassword = faker.internet.password();
const testFullName = faker.person.fullName();

test("Regsiter new user with an email", () => {
  const user = expect(
    store.users.registerUser(testFullName, testEmail, testPassword),
  );

  user.resolves.toBeString();
});

test("Register a duplicate email", () => {
  const user = expect(
    store.users.registerUser(testFullName, testEmail, testPassword),
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

  expect(store.users.activateUser(user!.activationToken!));
});

test("Activate user with an expired token", async () => {
  const user = store.users.repository.create({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    activationToken: "1234",
    activationTokenExpiry: new Date(Date.now() - 10 * 60 * 1000),
  });

  await store.users.repository.save(user);

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
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: testPassword2,
    }),
  );

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

  const userById = await store.users.findByID(user!.id);
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

test("Get user that doesn't exist by id", async () => {
  const userById = store.users.findByID(-1);
  expect(userById).rejects.toThrow(OperError);
  expect(userById).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
    message: "User not found",
    cause: "User with specified ID does not exist",
  });
});

test("Change user name", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const newName = faker.person.fullName();
  const updatedUser = await store.users.changeName(user.id, newName);

  expect(updatedUser.name).toBe(newName);
});

test("Change name of a non-existent user", async () => {
  const result = store.users.changeName(-1, faker.person.fullName());
  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Request email change", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const { otp } = await store.users.requestChangeEmail(user.id);

  const updatedUser = await store.users.repository.findOneBy({ id: user.id });

  expect(updatedUser!.emailChangeOtp).toBe(otp);
  expect(updatedUser!.emailChangeOtpExpiry).toBeInstanceOf(Date);
  expect(updatedUser!.emailChangeOtpExpiry!.getTime()).toBeGreaterThan(
    Date.now(),
  );
});

test("Request email change for a non-existent user", async () => {
  const result = store.users.requestChangeEmail(-1);
  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Change email", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const { otp } = await store.users.requestChangeEmail(user.id);
  const newEmail = faker.internet.email();
  await store.users.changeEmail(user.id, otp, newEmail);

  const updatedUser = await store.users.repository.findOneBy({ id: user.id });

  expect(updatedUser!.email).toBe(newEmail);
  expect(updatedUser!.emailChangeOtp).toBeNull();
  expect(updatedUser!.emailChangeOtpExpiry).toBeNull();
});

test("Change email with wrong OTP", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  await store.users.requestChangeEmail(user.id);
  const result = store.users.changeEmail(
    user.id,
    "wrong-otp",
    faker.internet.email(),
  );

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.EmailChangeOtpInvalidOrExpired,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Change password", async () => {
  const password = faker.internet.password();
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: User.hashPassword(password),
    }),
  );

  const newPassword = faker.internet.password();
  await store.users.changePassword(user.id, password, newPassword);

  const updatedUser = await store.users.repository.findOneBy({ id: user.id });
  expect(updatedUser!.verifyPassword(newPassword)).toBeTrue();
});

test("Change password with wrong current password", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: User.hashPassword(faker.internet.password()),
    }),
  );

  const result = store.users.changePassword(
    user.id,
    "wrong-password",
    faker.internet.password(),
  );

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.WrongCurrentPassword,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Request password reset", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const { token } = await store.users.requestPasswordReset(user.id);

  const updatedUser = await store.users.repository.findOneBy({ id: user.id });

  expect(updatedUser!.passwordResetToken).toBe(token);
  expect(updatedUser!.passwordResetTokenExpiry).toBeInstanceOf(Date);
  expect(updatedUser!.passwordResetTokenExpiry!.getTime()).toBeGreaterThan(
    Date.now(),
  );
});

test("Request password reset for a non-existent user", async () => {
  const result = store.users.requestPasswordReset(-1);
  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Reset password", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const { token } = await store.users.requestPasswordReset(user.id);
  const newPassword = faker.internet.password();
  await store.users.resetPassword(token, newPassword);

  const updatedUser = await store.users.repository.findOneBy({ id: user.id });

  expect(updatedUser!.verifyPassword(newPassword)).toBeTrue();
  expect(updatedUser!.passwordResetToken).toBeNull();
  expect(updatedUser!.passwordResetTokenExpiry).toBeNull();
});

test("Reset password with an invalid token", async () => {
  const result = store.users.resetPassword(
    "invalid-token",
    faker.internet.password(),
  );
  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.InvalidResetToken,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Add address to user", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const addressData = {
    name: "Address 1",
    country: faker.location.country(),
    state: faker.location.state(),
    city: faker.location.city(),
    street: faker.location.street(),
    building: faker.location.buildingNumber(),
    floor: "3",
  };

  const address = await store.users.addAddress(
    user.id,
    addressData.name,
    addressData.country,
    addressData.state,
    addressData.city,
    addressData.street,
    addressData.building,
    addressData.floor,
  );

  expect(address).toMatchObject({
    id: expect.any(Number),
    userId: user.id,
    country: addressData.country,
    state: addressData.state,
    city: addressData.city,
    street: addressData.street,
    building: addressData.building,
    floor: addressData.floor,
  });

  const userWithAddress = await store.users.repository.findOne({
    where: { id: user.id },
    relations: { addresses: true },
  });

  expect(userWithAddress).toBeDefined();
  expect(userWithAddress!.addresses).toHaveLength(1);
  expect(userWithAddress!.addresses![0]).toMatchObject({
    id: expect.any(Number),
    userId: user.id,
    name: addressData.name,
    country: addressData.country,
    state: addressData.state,
    city: addressData.city,
    street: addressData.street,
    building: addressData.building,
    floor: addressData.floor,
  });
});

test("Add address to a non-existent user", async () => {
  const result = store.users.addAddress(
    -1,
    "Home",
    faker.location.country(),
    faker.location.state(),
    faker.location.city(),
    faker.location.street(),
    faker.location.buildingNumber(),
  );

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.UserNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Update an existing address", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const address = await store.users.addAddress(
    user.id,
    "Home",
    faker.location.country(),
    faker.location.state(),
    faker.location.city(),
    faker.location.street(),
    faker.location.buildingNumber(),
  );

  const updatedData = {
    name: "Work",
    country: faker.location.country(),
    state: faker.location.state(),
    city: faker.location.city(),
    street: faker.location.street(),
    building: faker.location.buildingNumber(),
    floor: "5",
  };

  const updated = await store.users.updateAddress(
    address.id,
    updatedData.name,
    updatedData.country,
    updatedData.state,
    updatedData.city,
    updatedData.street,
    updatedData.building,
    updatedData.floor,
  );

  expect(updated).toMatchObject({
    id: address.id,
    userId: user.id,
    name: updatedData.name,
    country: updatedData.country,
    state: updatedData.state,
    city: updatedData.city,
    street: updatedData.street,
    building: updatedData.building,
    floor: updatedData.floor,
  });
});

test("Update a non-existent address", async () => {
  const result = store.users.updateAddress(
    -1,
    "Home",
    faker.location.country(),
    faker.location.state(),
    faker.location.city(),
    faker.location.street(),
    faker.location.buildingNumber(),
  );

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.AddressNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});

test("Delete an existing address", async () => {
  const user = await store.users.repository.save(
    store.users.repository.create({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    }),
  );

  const address = await store.users.addAddress(
    user.id,
    "Home",
    faker.location.country(),
    faker.location.state(),
    faker.location.city(),
    faker.location.street(),
    faker.location.buildingNumber(),
  );

  await store.users.removeAddress(address.id);

  const deleted = await store.users.addressRepository.findOne({
    where: { id: address.id },
  });
  expect(deleted).toBeNull();
});

test("Delete a non-existent address", async () => {
  const result = store.users.removeAddress(-1);

  expect(result).rejects.toThrow(OperError);
  expect(result).rejects.toMatchObject({
    code: UserErrorCodes.AddressNotFound,
    message: expect.any(String),
    cause: expect.any(String),
  });
});
