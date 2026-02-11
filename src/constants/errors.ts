export class DxtradeError extends Error {
  public code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DxtradeError";
    this.code = code;
  }
}
