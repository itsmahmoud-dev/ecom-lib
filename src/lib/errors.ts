import { DrizzleQueryError } from "drizzle-orm";
import pc from "picocolors";

import { extractKeyValue } from "./string";

export type ErrorSeverity = "error" | "warning" | "info";

// ================================ Error Codes ================================

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
  BarcodeAlreadyExists = "P000",
  ProductNotFound = "P001",
  VariantNotFound = "P002",
  ImageNotFound = "P003",
  VersionMismatch = "P004",
}

export enum FacetErrorCodes {
  FacetAlreadyExists = "F000",
  FacetNotFound = "F001",
}

export enum CartItemErrorsCodes {
  CartItemNotFound = "B000",
  QuantityInvalid = "B001",
}

type args = {
  code: string;
  severity: ErrorSeverity;
  userMessage: string;
  logMessage?: string;
  cause?: string;
  key?: string | string[];
  value?: string | string[];
};

export class OperationalError extends Error {
  code: string;
  severity: ErrorSeverity;
  userMessage: string;
  logMessage?: string;
  override cause?: string;
  key?: string | string[];
  value?: string | string[];

  constructor(params: args) {
    super();
    this.code = params.code;
    this.severity = params.severity;
    this.userMessage = params.userMessage;
    this.logMessage = params.logMessage;
    this.cause = params.cause;
    this.key = params.key;
    if (this.logMessage) {
      this.value = params.value;
      logMessage(this.severity, this.logMessage);
    }
  }
}

// ================================ Error Handling ================================

export function handleError(e: unknown): never {
  if (isUniqueViolationError(e)) {
    const [key, value] = extractKeyValue(e.cause.detail);
    if (e.cause.table === "facets") {
      if (key?.includes("key") || key?.includes("value")) {
        throw new OperationalError({
          code: FacetErrorCodes.FacetAlreadyExists,
          severity: "info",
          logMessage: `Attempt to insert/update facet with key/value (${value}) failed because a facet with the same key/value already exists.`,
          userMessage: "Facet already exists",
          cause: `Facet (${value}) already exists`,
          key: key?.split(","),
          value: value?.split(","),
        });
      }
    }
    if (e.cause.table === "products") {
      if (key === "barcode") {
        throw new OperationalError({
          code: ProductErrorCodes.BarcodeAlreadyExists,
          severity: "info",
          logMessage: `Attempt to insert/update product with barcode (${value}) failed because a product with the same barcode already exists.`,
          userMessage: "Barcode is registered to another product",
          cause: `Barcode (${value}) is already registered to another product`,
          key: key,
          value: value,
        });
      }
    }
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

export function logMessage(severity: ErrorSeverity, message: string) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (severity === "error") {
    console.log(
      pc.bgRed(severity.toUpperCase()),
      `[${new Date().toLocaleString()}]: ${message}`,
    );
  }

  if (severity === "warning") {
    console.log(
      pc.bgYellow(severity.toUpperCase()),
      `[${new Date().toLocaleString()}]: ${message}`,
    );
  }

  if (severity === "info") {
    console.log(
      pc.bgBlue(severity.toUpperCase()),
      `[${new Date().toLocaleString()}]: ${message}`,
    );
  }
}
