type args = {
  message: string;
  code: string;
  cause?: string;
};

export class OperError extends Error {
  code: string;
  override message: string;
  override cause?: string;

  constructor({ cause, code, message }: args) {
    super();
    this.code = code;
    this.message = message;
    this.cause = cause;
  }
}
