export class FeriasHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

export function toApiError(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof FeriasHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  return { status: 500, body: { error: "Ocorreu um erro inesperado.", code: "INTERNAL_ERROR" } };
}
