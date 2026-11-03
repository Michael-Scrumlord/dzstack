// Every error the domain raises on purpose carries a stable `code`; the API layer maps codes to statuses.

export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(kind: string, id: string) {
    super("not_found", `${kind} ${id} not found`);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("validation", message);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(sku: string, wanted: number, available: number) {
    super("insufficient_stock", `${sku}: wanted ${wanted}, only ${available} available`);
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(kind: string, from: string, to: string) {
    super("invalid_transition", `a ${kind} that is ${from} cannot become ${to}`);
  }
}

export class ReservationExpiredError extends DomainError {
  constructor(id: string) {
    super("reservation_expired", `reservation ${id} was released and can no longer be confirmed`);
  }
}

export class TimeoutError extends DomainError {
  constructor(ms: number) {
    super("timeout", `no answer after ${ms} ms`);
  }
}

export class RetryExhaustedError extends DomainError {
  readonly cause: unknown;

  constructor(attempts: number, cause: unknown) {
    super("retry_exhausted", `gave up after ${attempts} attempts: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.cause = cause;
  }
}

export class InvariantError extends DomainError {
  constructor(message: string) {
    super("invariant", message);
  }
}
