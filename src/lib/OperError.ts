type args = {
  message: string;
  code: string;
  cause?: string;
  key?: string | string[];
  value?: string | string[];
};

export class OperError extends Error {
  code: string;
  override message: string;
  override cause?: string;
  key?: string | string[];
  value?: string | string[];

  constructor({ cause, code, message, key, value }: args) {
    super();
    this.code = code;
    this.message = message;
    this.cause = cause;
    this.key = key;
    this.value = value;
  }
}
