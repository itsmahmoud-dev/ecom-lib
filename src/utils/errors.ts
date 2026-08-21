import { DrizzleQueryError } from "drizzle-orm";
import { extractKeyValue } from "./string";

// ================================ Error Codes ================================
export enum CustomErrorCodes {
  EmptyCart = "C001",

  OrderAlreadyCanceled = "OR001",
  OrderCannotBeCanceled = "OR002",

  ProductVersionMismatch = "P001",
  InsuffecientImages = "P002",

  AccountNotVerified = "U001",
  IncorrectPassword = "U002",
  RequestingSameEmailChange = "U003",
  InvalidVerificationOtp = "U004",
  ExpiredVerificationOtp = "U005",
  InvalidEmailChangeOtp = "U006",
  ExpiredEmailChangeOtp = "U007",
  ExpiredPasswordResetToken = "U008",
}

export enum CustomErrorMessages {
  C001 = "Trying to place an order with an empty cart",
  OR001 = "Trying to update an already canceled order",
  OR002 = "Trying to cancel an order past the pending state",
  P001 = "Trying to update a product with an expired version",
  P002 = "Trying to update a product with insufficient images",
  U001 = "Trying to login user with an unverified account",
  U002 = "Trying to login with an incorrect password",
  U003 = "Trying to change email to the same email",
  U004 = "Trying to verify an account with an invalid otp",
  U005 = "Trying to verify an account with an expired otp",
  U006 = "Trying to change an email with an invalid otp",
  U007 = "Trying to change an email with an expired otp",
  U008 = "Trying to reset an email with an expired token",
}

// =================== Errors Classes ===================
export class NotFoundError extends Error {
  entity: string;
  context?: string;

  constructor(entity: string, context?: string) {
    super(
      context
        ? `${entity} was not found (${context})`
        : `${entity} was not found`,
    );
    this.entity = entity;
    this.context = context;
  }
}

export class AlreadyExistsError extends Error {
  entity: string;
  context?: string;

  constructor(entity: string, context?: string) {
    super(
      context
        ? `${entity} already exists`
        : `${entity} already exists (${context})`,
    );
    this.entity = entity;
    this.context = context;
  }
}

export class CheckViolationError extends Error {
  entity: string;
  constraint?: string;

  constructor(entity: string, constraint?: string) {
    super(
      constraint
        ? `${entity} violates constraint ${constraint}`
        : `${entity} violates constraint`,
    );
    this.entity = entity;
    this.constraint = constraint;
  }
}

export class QuantityInsufficientError extends Error {
  entity: string;
  desiredQuantity: number;
  availableQuantity: number;

  constructor(
    entity: string,
    desiredQuantity: number,
    availableQuantity: number,
  ) {
    super(
      `Desired quantity (${desiredQuantity}) exceeds available quantity (${availableQuantity}) for ${entity}`,
    );
    this.entity = entity;
    this.desiredQuantity = desiredQuantity;
    this.availableQuantity = availableQuantity;
  }
}

export class CustomError extends Error {
  code: CustomErrorCodes;

  constructor(code: CustomErrorCodes, data?: any) {
    super(CustomErrorMessages[code]);
    this.code = code;
  }
}

// ================================ Error Handling ================================
export function handleError(e: unknown): never {
  if (isUniqueViolationError(e)) {
    const [key, value] = extractKeyValue(e.cause.detail);
    throw new AlreadyExistsError(e.cause.table, `${key}: ${value}`);
  }

  if (isCheckViolationError(e))
    throw new CheckViolationError(e.cause.table, e.cause.constraint);

  if (isForeignKeyViolation(e)) {
    const [key, value] = e.cause.detail;
    throw new NotFoundError(e.cause.table, `${key}: ${value}`);
  }

  throw e;
}

export function isUniqueViolationError(e: unknown): e is DrizzleQueryError & {
  cause: { errno: string; detail: string; table: string };
} {
  return (
    e instanceof DrizzleQueryError &&
    "cause" in e &&
    typeof e.cause === "object" &&
    e.cause !== null &&
    "errno" in e.cause &&
    "table" in e.cause &&
    e.cause.errno === "23505"
  );
}

export function isCheckViolationError(e: unknown): e is DrizzleQueryError & {
  cause: { errno: string; detail: string; constraint: string; table: string };
} {
  return (
    e instanceof DrizzleQueryError &&
    "cause" in e &&
    typeof e.cause === "object" &&
    e.cause !== null &&
    "errno" in e.cause &&
    "table" in e.cause &&
    "constraint" in e.cause &&
    e.cause.errno === "23514"
  );
}

export function isForeignKeyViolation(e: unknown): e is DrizzleQueryError & {
  cause: { errno: string; detail: string; constraint: string; table: string };
} {
  return (
    e instanceof DrizzleQueryError &&
    "cause" in e &&
    typeof e.cause === "object" &&
    e.cause !== null &&
    "errno" in e.cause &&
    "table" in e.cause &&
    "constraint" in e.cause &&
    e.cause.errno === "23503"
  );
}
