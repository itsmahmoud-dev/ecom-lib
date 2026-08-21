import z from "zod";

export const registerUserParamsSchema = z.strictObject({
  name: z.string().nonempty(),
  email: z.email(),
  password: z.string().min(8),
});

export const verifyUserParamsSchema = z.strictObject({
  email: z.email(),
  otp: z.string().nonempty(),
  rememberMe: z.boolean().default(false).optional(),
});

export const logUserInParamsSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(8),
  rememberMe: z.boolean().default(false).optional(),
});

export const changeNameParamsSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().nonempty(),
});

export const requestChangeEmailParamsSchema = z.strictObject({
  id: z.uuid(),
  newEmail: z.email(),
});

export const changeEmailParamsSchema = z.strictObject({
  id: z.uuid(),
  otp: z.string().nonempty(),
  newEmail: z.email(),
  password: z.string().min(8),
});

export const changePasswordParamsSchema = z.strictObject({
  id: z.uuid(),
  oldPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

export const requestResetPasswordParamsSchema = z.email();

export const resetPasswordParamsSchema = z.strictObject({
  token: z.string().nonempty(),
  newPassword: z.string().nonempty(),
});

export const addAddressParamsSchema = z.strictObject({
  userId: z.uuid(),
  address: z.strictObject({
    name: z.string().nonempty(),
    country: z.string().nonempty(),
    state: z.string().nonempty(),
    city: z.string().nonempty(),
    street: z.string().nonempty(),
    building: z.string().nonempty(),
    floor: z.int().optional(),
  }),
});

export const updateAddressParamsSchema = z.strictObject({
  id: z.uuid(),
  ...addAddressParamsSchema.shape.address.partial().shape,
});

export const deleteAddressParamsSchema = z.uuid();
