import {
  validateInvite,
  validateProfileUpdate,
  validateSignup,
  type InviteInput,
  type ProfileUpdateInput,
  type SignupInput,
  type ValidationResult,
} from "./validators.ts";

export interface HttpResponse {
  status: number;
  body: unknown;
}

function respond(result: ValidationResult, accepted: unknown): HttpResponse {
  if (result.ok) return { status: 200, body: accepted };
  return { status: 422, body: { errors: result.errors } };
}

export function handleSignup(body: SignupInput): HttpResponse {
  return respond(validateSignup(body), { created: true });
}

export function handleProfileUpdate(body: ProfileUpdateInput): HttpResponse {
  return respond(validateProfileUpdate(body), { updated: true });
}

export function handleInvite(body: InviteInput): HttpResponse {
  return respond(validateInvite(body), { invited: true });
}
