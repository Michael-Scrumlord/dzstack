import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInvite, handleProfileUpdate, handleSignup } from "../src/routes.ts";

test("a valid signup is accepted", () => {
  const res = handleSignup({ email: "ada@example.com", username: "ada_l", password: "analytical1", acceptTerms: true });
  assert.deepEqual(res, { status: 200, body: { created: true } });
});

test("problems come back as a 422 with the list of errors", () => {
  const res = handleInvite({ email: "", role: "viewer" });
  assert.deepEqual(res, { status: 422, body: { errors: [{ field: "email", message: "Email is required" }] } });
});

test("a profile update with nothing to change is accepted", () => {
  assert.deepEqual(handleProfileUpdate({}), { status: 200, body: { updated: true } });
});
