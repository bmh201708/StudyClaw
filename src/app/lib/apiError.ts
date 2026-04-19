export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function readApiError(res: Response): Promise<ApiError> {
  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  return new ApiError(payload.error || `request failed (${res.status})`, res.status, payload);
}

