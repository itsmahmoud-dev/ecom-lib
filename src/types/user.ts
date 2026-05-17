export enum UserRole {
  ADMIN = "admin",
  MEMBER = "member",
  CUSTOMER = "customer",
}

export enum UserStatus {
  PENDING = "pending",
  ACTIVE = "active",
}

export type CreateUserWithEmailProps = {
  type: "email";
  name: string;
  email: string;
  password: string;
};

export type CreateUserWithPhoneNumberProps = {
  type: "phoneNumber";
  name: string;
  phoneNumber: string;
  password: string;
};
