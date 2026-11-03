import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInvite, validateProfileUpdate, validateSignup } from "../src/validators.ts";

const signup = { email: "ada@example.com", username: "ada_l", password: "analytical1", acceptTerms: true };

test("a complete signup is accepted", () => {
  assert.deepEqual(validateSignup(signup), { ok: true });
});

test("signup reports missing fields", () => {
  const result = validateSignup({ ...signup, email: "", password: "", acceptTerms: false });
  assert.deepEqual(result, {
    ok: false,
    errors: [
      { field: "email", message: "Email is required" },
      { field: "password", message: "Password is required" },
      { field: "acceptTerms", message: "You must accept the terms" },
    ],
  });
});

test("signup rejects a short password", () => {
  const result = validateSignup({ ...signup, password: "abc123" });
  assert.deepEqual(result, { ok: false, errors: [{ field: "password", message: "Password must be at least 10 characters" }] });
});

test("an empty profile update changes nothing and is fine", () => {
  assert.deepEqual(validateProfileUpdate({}), { ok: true });
});

test("a profile update checks only the fields it carries", () => {
  assert.deepEqual(validateProfileUpdate({ bio: "x".repeat(161) }), {
    ok: false,
    errors: [{ field: "bio", message: "Bio is too long (max 160 characters)" }],
  });
  assert.deepEqual(validateProfileUpdate({ email: "not-an-email" }), {
    ok: false,
    errors: [{ field: "email", message: "Enter a valid email address" }],
  });
});

test("an invite needs a known role", () => {
  assert.deepEqual(validateInvite({ email: "bob@example.com", role: "editor" }), { ok: true });
  assert.deepEqual(validateInvite({ email: "bob@example.com", role: "owner" }), {
    ok: false,
    errors: [{ field: "role", message: "Role must be viewer, editor or admin" }],
  });
});
