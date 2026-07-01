export class AzureApiError extends Error {
  override readonly name = "AzureApiError";
  readonly code: "AZURE_FETCH_FAILED" | "AZURE_DIFF_EMPTY";
  readonly status: number;

  constructor(code: AzureApiError["code"], status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.status = status;
  }
}

export const AZURE_EMPTY_DIFF_STATUS = 200;
