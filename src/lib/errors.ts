import { DrizzleQueryError } from "drizzle-orm";
import pc from "picocolors";

import { extractKeyValue } from "./string";
import { OperError } from "./OperError";

export enum UserErrorCodes {
  TokenInvalidOrExpired = "U600",
  InvalidEmailOrPassword = "U601",
  AccountNotVerified = "U602",
  EmailAlreadyRegistered = "U603",
  UserNotFound = "U604",
  EmailChangeOtpInvalidOrExpired = "U605",
  WrongCurrentPassword = "U606",
  InvalidResetToken = "U607",
  AddressNotFound = "U608",
}

export enum ProductErrorCodes {
  BarcodeAlreadyExists = "P600",
  ProductNotFound = "P601",
}

export enum FacetErrorCodes {
  FacetAlreadyExists = "F600",
  FacetNotFound = "F601",
}

export function handleError(e: unknown) {
  if (isUniqueViolationError(e)) {
    const [key, value] = extractKeyValue(e.cause.detail);
    if (key === "email") {
      logMessage(
        "info",
        `Attempt to insert a new user with email (${value}) failed because an account with the same email already exists.`,
      );
      throw new OperError({
        code: UserErrorCodes.EmailAlreadyRegistered,
        message: "Email already registered to another account",
        cause: `Email ${value} is registered to another account`,
        key: key?.split(","),
        value: value?.split(","),
      });
    }
  }
}

export function isUniqueViolationError(
  e: unknown,
): e is DrizzleQueryError & { cause: { code: string; detail: string } } {
  return (
    e instanceof DrizzleQueryError &&
    "cause" in e &&
    typeof e.cause === "object" &&
    e.cause !== null &&
    "code" in e.cause &&
    e.cause.code === "23505"
  );
}

export function logMessage(
  severity: "error" | "warn" | "info" | "success",
  message: string,
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (severity === "success") {
    console.log(pc.bgGreen(`[${new Date().toLocaleString()}]: ${message}`));
  }
  if (severity === "error") {
    console.log(pc.bgRed(`[${new Date().toLocaleString()}]: ${message}`));
  }
  if (severity === "warn") {
    console.log(pc.bgYellow(`[${new Date().toLocaleString()}]: ${message}`));
  }
  if (severity === "info") {
    console.log(pc.bgCyan(`[${new Date().toLocaleString()}]: ${message}`));
  }
}
