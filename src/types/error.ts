export enum UserErrorCodes {
  TokenInvalidOrExpired = "U600",
  InvalidEmailOrPassword = "U601",
  AccountNotVerified = "U602",
  EmailAlreadyRegistered = "U603",
  UserNotFound = "U604",
  EmailChangeOtpInvalidOrExpired = "U605",
  WrongCurrentPassword = "U606",
}

export enum ProductErrorCodes {
  BarcodeAlreadyExists = "P600",
  ProductNotFound = "P601",
}

export enum FacetErrorCodes {
  FacetAlreadyExists = "F600",
  FacetNotFound = "F601",
}
