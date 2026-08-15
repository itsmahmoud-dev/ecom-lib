import { DrizzleQueryError } from "drizzle-orm";
import pc from "picocolors";

import { extractKeyValue } from "./string";
import {
  getTableConfig,
  type PgColumn,
  type PgTable,
} from "drizzle-orm/pg-core";
import {
  addresses,
  cartItems,
  imagesToAttributes,
  inCollection,
  productsToAttributes,
  productVariantsToAttributes,
} from "../db/schema";

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
  AddressNoFound = "U010",
}

export enum ProductErrorCodes {
  BarcodeAlreadyExists = "P000",
  ProductNotFound = "P001",
  VariantNotFound = "P002",
  ImageNotFound = "P003",
  VersionMismatch = "P004",
  InsuffecientImages = "P005",
}

export enum AttributeErrorCodes {
  AttributeAlreadyExists = "F000",
  AttributeNotFound = "F001",
}

export enum CartItemErrorsCodes {
  CartItemNotFound = "B000",
  QuantityInvalid = "B001",
  CartItemAlreadyExists = "B002",
}

export enum CollectionErrorCodes {
  CollectionNotFound = "C000",
}

export enum OrderErrorCodes {
  CartEmpty = "OR000",
  OrderNotFound = "OR001",
  InvalidOrderStatus = "OR002",
  QuantityNotEnough = "OR003",
}

// =================== Error Class ===================

type args = {
  code: string;
  message: string;
  cause?: string;
  data?: any;
};

export class OperationalError extends Error {
  code: string;
  override message: string;
  override cause?: string;
  data: any;

  constructor(params: args) {
    super();
    this.code = params.code;
    this.message = params.message;
    this.cause = params.cause;
    this.data = params.data;
  }
}

// ================================ Error Handling ================================

export function handleError(e: unknown): never {
  if (isUniqueViolationError(e)) {
    const [key, value] = extractKeyValue(e.cause.detail);
    if (e.cause.table === "attributes") {
      if (key?.includes("key") || key?.includes("value")) {
        throw new OperationalError({
          code: AttributeErrorCodes.AttributeAlreadyExists,
          message: `Inserting/updating an attribute failed because they key value pair already exists`,
        });
      }
    }
    if (e.cause.table === "products") {
      if (key === "barcode") {
        throw new OperationalError({
          code: ProductErrorCodes.BarcodeAlreadyExists,
          message: `Inserting/Updating a product with barcode (${value}) failed because a product with the same barcode already exists.`,
        });
      }
    }
    if (e.cause.table === "cartItems") {
      if (
        key?.includes("user_id") ||
        key?.includes("product_id") ||
        key?.includes("variant_id")
      ) {
        throw new OperationalError({
          code: CartItemErrorsCodes.CartItemAlreadyExists,
          message: "Adding cart item failed because it already exists",
        });
      }
    }
  }

  if (isCheckViolationError(e)) {
    if (e.cause.table === "cartItems" && e.cause.constraint === "min_quantity") {
      throw new OperationalError({
        code: CartItemErrorsCodes.QuantityInvalid,
        message: `Updating cart item quantity failed because the quantity is not positive`,
      });
    }
  }

  if (isForeignKeyViolation(e)) {
    const [key, value] = e.cause.detail;
    if (
      e.cause.constraint ===
      getForeignKeyConstraintName(cartItems, cartItems.userId)
    ) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        message: "Adding a cart item failed because the user was not found",
      });
    }
    if (
      e.cause.constraint ===
      getForeignKeyConstraintName(cartItems, cartItems.variantId)
    ) {
      throw new OperationalError({
        code: ProductErrorCodes.VariantNotFound,
        message:
          "Adding a cart item failed because one of the variants was not found",
      });
    }
    if (
      e.cause.constraint ===
      getForeignKeyConstraintName(cartItems, cartItems.productId)
    ) {
      throw new OperationalError({
        code: ProductErrorCodes.ProductNotFound,
        message: "Adding a cart item failed because the product was not found",
      });
    }
    if (
      e.cause.constraint ===
        getForeignKeyConstraintName(
          productsToAttributes,
          productsToAttributes.attributeId,
        ) ||
      e.cause.constraint ===
        getForeignKeyConstraintName(
          productVariantsToAttributes,
          productVariantsToAttributes.attributeId,
        ) ||
      e.cause.constraint ===
        getForeignKeyConstraintName(
          imagesToAttributes,
          imagesToAttributes.attributeId,
        )
    ) {
      throw new OperationalError({
        code: AttributeErrorCodes.AttributeNotFound,
        message:
          "Adding a cart item failed because one of the attributes was not found",
      });
    }
    if (
      e.cause.constraint ===
      getForeignKeyConstraintName(addresses, addresses.userId)
    ) {
      throw new OperationalError({
        code: UserErrorCodes.UserNotFound,
        message: "Adding an address failed because the user was not found",
      });
    }

    if (
      e.cause.constraint ===
      getForeignKeyConstraintName(inCollection, inCollection.productId)
    ) {
      throw new OperationalError({
        code: ProductErrorCodes.ProductNotFound,
        message:
          "Adding a product to a collection failed because the product was not found",
      });
    }

    if (
      e.cause.constraint ===
      getForeignKeyConstraintName(inCollection, inCollection.collectionId)
    ) {
      throw new OperationalError({
        code: CollectionErrorCodes.CollectionNotFound,
        message:
          "Adding a product to a collection failed because the collection was not found",
      });
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

function getForeignKeyConstraintName(table: PgTable, column: PgColumn) {
  const config = getTableConfig(table);
  const ref = config.foreignKeys.filter((key) =>
    key
      .reference()
      .columns.map((el) => el.name)
      .includes(column.name),
  );

  return ref[0]?.getName();
}
