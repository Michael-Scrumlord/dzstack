export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string) => new HttpError(400, "invalid_request", message);
export const invalidQuery = (message: string) => new HttpError(400, "invalid_query", message);
export const unauthorized = () => new HttpError(401, "unauthorized", "missing or unknown session token");
export const forbidden = (message = "not allowed") => new HttpError(403, "forbidden", message);
export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);
export const conflict = (message: string) => new HttpError(409, "conflict", message);
