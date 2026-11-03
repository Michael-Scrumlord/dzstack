export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = "validation") {
    super(400, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "sign in first") {
    super(401, "unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "you are not allowed to do that") {
    super(403, "forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, "not_found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "conflict", message);
  }
}

/** The persistence adapter could not load or store a document. Nothing was changed. */
export class PersistenceError extends AppError {
  constructor(message = "storage is unavailable") {
    super(503, "storage_unavailable", message);
  }
}
