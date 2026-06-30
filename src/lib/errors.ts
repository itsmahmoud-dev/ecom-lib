import { DrizzleQueryError } from "drizzle-orm";
import pc from "picocolors";

import { extractKeyValue } from "./string";
import { OperError } from "./OperError";

export enum UserErrorCodes {
  UserNotFound = "U000",
  InvalidEmailOrPassword = "U001",
  EmailChangeOtpInvalidOrExpired = "U002",
  AccountNotVerified = "U003",
  VerificationOtpInvalidOrExpired = "U004",
  EmailAlreadyRegistered = "U005",
  WrongPassword = "U006",
  WrongCurrentPassword = "U007",
  InvalidOrExpiredResetToken = "U008",
  SameEmail = "U009",
}

export enum ProductErrorCodes {
  BarcodeAlreadyExists = "P600",
  ProductNotFound = "P601",
}

export enum FacetErrorCodes {
  FacetAlreadyExists = "F000",
  FacetNotFound = "F001",
}

export function handleError(e: unknown): never {
  if (isUniqueViolationError(e)) {
    const [key, value] = extractKeyValue(e.cause.detail);
    if (e.cause.table === "users") {
      if (key === "email") {
        logMessage(
          "info",
          `Attempt to register/change email to (${value}) failed because an account with the same email already exists.`,
        );
        throw new OperError({
          code: UserErrorCodes.EmailAlreadyRegistered,
          message: "Email is already taken",
          cause: `Email (${value}) is already taken`,
          key: key?.split(","),
          value: value?.split(","),
        });
      }
    }
    if (e.cause.table === "facets") {
      if (key?.includes("key") || key?.includes("value")) {
        logMessage(
          "info",
          `Attempt to insert/update facet with key/value (${value}) failed because a facet with the same key/value already exists.`,
        );
        throw new OperError({
          code: FacetErrorCodes.FacetAlreadyExists,
          message: "Facet already exists",
          cause: `Facet (${value}) already exists`,
          key: key?.split(","),
          value: value?.split(","),
        });
      }
    }
    if (e.cause.table === "products") {
      if (key === "barcode") {
        logMessage(
          "info",
          `Attempt to insert/update product with barcode (${value}) failed because a product with the same barcode already exists.`,
        );
        throw new OperError({
          code: ProductErrorCodes.BarcodeAlreadyExists,
          message: "Barcode is registered to another product",
          cause: `Barcode (${value}) is already registered to another product`,
          key: key?.split(","),
          value: value?.split(","),
        });
      }
    }
  }

  throw e;
}

export function isUniqueViolationError(e: unknown): e is DrizzleQueryError & {
  cause: { code: string; detail: string; table: string };
} {
  return (
    e instanceof DrizzleQueryError &&
    "cause" in e &&
    typeof e.cause === "object" &&
    e.cause !== null &&
    "code" in e.cause &&
    "table" in e.cause &&
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
    console.log(pc.green(`[${new Date().toLocaleString()}]: ${message}`));
  }
  if (severity === "error") {
    console.log(pc.red(`[${new Date().toLocaleString()}]: ${message}`));
  }
  if (severity === "warn") {
    console.log(pc.yellow(`[${new Date().toLocaleString()}]: ${message}`));
  }
  if (severity === "info") {
    console.log(pc.cyan(`[${new Date().toLocaleString()}]: ${message}`));
  }
}
