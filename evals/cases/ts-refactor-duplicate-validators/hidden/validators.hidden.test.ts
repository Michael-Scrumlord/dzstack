import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInvite, validateProfileUpdate, validateSignup } from "../src/validators.ts";
import { handleInvite, handleProfileUpdate, handleSignup } from "../src/routes.ts";

const err = (field: string, message: string) => ({ field, message });
const bad = (...errors: { field: string; message: string }[]) => ({ ok: false, errors });
const OK = { ok: true };
// An address of exactly n characters in a valid format.
const emailOfLength = (n: number) => `${"a".repeat(n - 5)}@b.co`;

const signup = { email: "ada@example.com", username: "ada_l", password: "analytical1", acceptTerms: true };
const invite = { email: "bob@example.com", role: "editor" };

// ---------- signup ----------

test("signup: email is trimmed, blank means required", () => {
  assert.deepEqual(validateSignup({ ...signup, email: "  ada@example.com  " }), OK);
  assert.deepEqual(validateSignup({ ...signup, email: "" }), bad(err("email", "Email is required")));
  assert.deepEqual(validateSignup({ ...signup, email: "   " }), bad(err("email", "Email is required")));
});

test("signup: email format and the 254 limit", () => {
  for (const email of ["nope", "a@b", "a b.c@example.org", "@c.de", "a@@c.de"]) {
    assert.deepEqual(validateSignup({ ...signup, email }), bad(err("email", "Enter a valid email address")), email);
  }
  assert.deepEqual(validateSignup({ ...signup, email: emailOfLength(254) }), OK);
  assert.deepEqual(
    validateSignup({ ...signup, email: emailOfLength(255) }),
    bad(err("email", "Email is too long (max 254 characters)")),
  );
  // The format is checked before the length.
  assert.deepEqual(validateSignup({ ...signup, email: "x".repeat(300) }), bad(err("email", "Enter a valid email address")));
  // Trimming comes first: 254 characters plus spaces is fine.
  assert.deepEqual(validateSignup({ ...signup, email: ` ${emailOfLength(254)} ` }), OK);
});

test("signup: username rules and their order", () => {
  assert.deepEqual(validateSignup({ ...signup, username: "" }), bad(err("username", "Username is required")));
  assert.deepEqual(validateSignup({ ...signup, username: "   " }), bad(err("username", "Username is required")));
  assert.deepEqual(validateSignup({ ...signup, username: "ab" }), bad(err("username", "Username must be 3-20 characters")));
  assert.deepEqual(validateSignup({ ...signup, username: "a".repeat(21) }), bad(err("username", "Username must be 3-20 characters")));
  assert.deepEqual(validateSignup({ ...signup, username: "abc" }), OK);
  assert.deepEqual(validateSignup({ ...signup, username: "a".repeat(20) }), OK);
  assert.deepEqual(validateSignup({ ...signup, username: "  abc  " }), OK);
  assert.deepEqual(validateSignup({ ...signup, username: "A..B" }), bad(err("username", "Username may only contain lowercase letters, digits and underscores")));
  // Length is checked before the characters.
  assert.deepEqual(validateSignup({ ...signup, username: ".." }), bad(err("username", "Username must be 3-20 characters")));
});

test("signup: dots are not allowed in a username", () => {
  const message = "Username may only contain lowercase letters, digits and underscores";
  assert.deepEqual(validateSignup({ ...signup, username: "ada.l" }), bad(err("username", message)));
  assert.deepEqual(validateSignup({ ...signup, username: "Ada_l" }), bad(err("username", message)));
  assert.deepEqual(validateSignup({ ...signup, username: "ada l" }), bad(err("username", message)));
  assert.deepEqual(validateSignup({ ...signup, username: "ada-l" }), bad(err("username", message)));
  assert.deepEqual(validateSignup({ ...signup, username: "ada_99" }), OK);
});

test("signup: display name is optional and a blank one is ignored", () => {
  assert.deepEqual(validateSignup(signup), OK);
  assert.deepEqual(validateSignup({ ...signup, displayName: "" }), OK);
  assert.deepEqual(validateSignup({ ...signup, displayName: "    " }), OK);
  assert.deepEqual(validateSignup({ ...signup, displayName: "x".repeat(40) }), OK);
  assert.deepEqual(validateSignup({ ...signup, displayName: `  ${"x".repeat(40)}  ` }), OK);
  assert.deepEqual(
    validateSignup({ ...signup, displayName: "x".repeat(41) }),
    bad(err("displayName", "Display name is too long (max 40 characters)")),
  );
});

test("signup: password is never trimmed, and the rules run in order", () => {
  assert.deepEqual(validateSignup({ ...signup, password: "" }), bad(err("password", "Password is required")));
  assert.deepEqual(validateSignup({ ...signup, password: "abcdefg12" }), bad(err("password", "Password must be at least 10 characters")));
  assert.deepEqual(validateSignup({ ...signup, password: "123" }), bad(err("password", "Password must be at least 10 characters")));
  assert.deepEqual(validateSignup({ ...signup, password: "abcdefghij" }), bad(err("password", "Password needs a letter and a digit")));
  assert.deepEqual(validateSignup({ ...signup, password: "1234567890" }), bad(err("password", "Password needs a letter and a digit")));
  assert.deepEqual(validateSignup({ ...signup, password: "          " }), bad(err("password", "Password needs a letter and a digit")));
  assert.deepEqual(validateSignup({ ...signup, password: "abcdefgh1 " }), OK);
  assert.deepEqual(validateSignup({ ...signup, password: " abcdefgh1" }), OK);
  assert.deepEqual(validateSignup({ ...signup, password: "abcdefghi1" }), OK);
});

test("signup: phone and company are optional, trimmed, and blank is ignored", () => {
  const phoneError = bad(err("phone", "Enter a valid phone number"));
  assert.deepEqual(validateSignup({ ...signup, phone: "" }), OK);
  assert.deepEqual(validateSignup({ ...signup, phone: "   " }), OK);
  assert.deepEqual(validateSignup({ ...signup, phone: "+1 (555) 010-9999" }), OK);
  assert.deepEqual(validateSignup({ ...signup, phone: "  555 0100  " }), OK);
  assert.deepEqual(validateSignup({ ...signup, phone: "123456" }), phoneError);
  assert.deepEqual(validateSignup({ ...signup, phone: "1".repeat(20) }), OK);
  assert.deepEqual(validateSignup({ ...signup, phone: "1".repeat(21) }), phoneError);
  assert.deepEqual(validateSignup({ ...signup, phone: "555-CALL-NOW" }), phoneError);
  assert.deepEqual(validateSignup({ ...signup, phone: "555 0100 +1" }), phoneError);
  assert.deepEqual(validateSignup({ ...signup, company: "" }), OK);
  assert.deepEqual(validateSignup({ ...signup, company: "c".repeat(60) }), OK);
  assert.deepEqual(validateSignup({ ...signup, company: ` ${"c".repeat(60)} ` }), OK);
  assert.deepEqual(
    validateSignup({ ...signup, company: "c".repeat(61) }),
    bad(err("company", "Company is too long (max 60 characters)")),
  );
});

test("signup: the terms must be accepted", () => {
  assert.deepEqual(validateSignup({ ...signup, acceptTerms: false }), bad(err("acceptTerms", "You must accept the terms")));
});

test("signup: every problem is reported, in field order", () => {
  const result = validateSignup({
    email: "nope",
    username: "X",
    displayName: "x".repeat(50),
    password: "",
    phone: "call me",
    company: "c".repeat(70),
    acceptTerms: false,
  });
  assert.deepEqual(
    result,
    bad(
      err("email", "Enter a valid email address"),
      err("username", "Username must be 3-20 characters"),
      err("displayName", "Display name is too long (max 40 characters)"),
      err("password", "Password is required"),
      err("phone", "Enter a valid phone number"),
      err("company", "Company is too long (max 60 characters)"),
      err("acceptTerms", "You must accept the terms"),
    ),
  );
});

// ---------- profile update ----------

test("profile update: nothing to change is fine", () => {
  assert.deepEqual(validateProfileUpdate({}), OK);
});

test("profile update: email is not trimmed", () => {
  const invalid = bad(err("email", "Enter a valid email address"));
  assert.deepEqual(validateProfileUpdate({ email: "ada@example.com" }), OK);
  assert.deepEqual(validateProfileUpdate({ email: " ada@example.com" }), invalid);
  assert.deepEqual(validateProfileUpdate({ email: "ada@example.com " }), invalid);
  assert.deepEqual(validateProfileUpdate({ email: "   " }), invalid);
});

test("profile update: an empty email has its own message", () => {
  assert.deepEqual(validateProfileUpdate({ email: "" }), bad(err("email", "Email cannot be empty")));
});

test("profile update: the email limit is 120, after the format check", () => {
  assert.deepEqual(validateProfileUpdate({ email: emailOfLength(120) }), OK);
  assert.deepEqual(
    validateProfileUpdate({ email: emailOfLength(121) }),
    bad(err("email", "Email is too long (max 120 characters)")),
  );
  assert.deepEqual(
    validateProfileUpdate({ email: emailOfLength(200) }),
    bad(err("email", "Email is too long (max 120 characters)")),
  );
  assert.deepEqual(validateProfileUpdate({ email: "x".repeat(200) }), bad(err("email", "Enter a valid email address")));
  assert.deepEqual(validateProfileUpdate({ email: "nope" }), bad(err("email", "Enter a valid email address")));
});

test("profile update: usernames may contain dots and are trimmed", () => {
  assert.deepEqual(validateProfileUpdate({ username: "ada.l" }), OK);
  assert.deepEqual(validateProfileUpdate({ username: "a.b.c_9" }), OK);
  assert.deepEqual(validateProfileUpdate({ username: "  ada.l  " }), OK);
  assert.deepEqual(validateProfileUpdate({ username: "" }), bad(err("username", "Username cannot be empty")));
  assert.deepEqual(validateProfileUpdate({ username: "   " }), bad(err("username", "Username cannot be empty")));
  assert.deepEqual(validateProfileUpdate({ username: "ab" }), bad(err("username", "Username must be 3-20 characters")));
  assert.deepEqual(validateProfileUpdate({ username: ".." }), bad(err("username", "Username must be 3-20 characters")));
  assert.deepEqual(validateProfileUpdate({ username: "a".repeat(21) }), bad(err("username", "Username must be 3-20 characters")));
  const message = "Username may only contain lowercase letters, digits, underscores and dots";
  assert.deepEqual(validateProfileUpdate({ username: "Ada.l" }), bad(err("username", message)));
  assert.deepEqual(validateProfileUpdate({ username: "ada l" }), bad(err("username", message)));
  assert.deepEqual(validateProfileUpdate({ username: "ada-l" }), bad(err("username", message)));
});

test("profile update: display name is trimmed and may not be blank", () => {
  assert.deepEqual(validateProfileUpdate({ displayName: "Ada" }), OK);
  assert.deepEqual(validateProfileUpdate({ displayName: `  ${"x".repeat(40)} ` }), OK);
  assert.deepEqual(validateProfileUpdate({ displayName: "" }), bad(err("displayName", "Display name cannot be empty")));
  assert.deepEqual(validateProfileUpdate({ displayName: "   " }), bad(err("displayName", "Display name cannot be empty")));
  assert.deepEqual(
    validateProfileUpdate({ displayName: "x".repeat(41) }),
    bad(err("displayName", "Display name is too long (max 40 characters)")),
  );
});

test("profile update: phone and company are trimmed and may be emptied", () => {
  const phoneError = bad(err("phone", "Enter a valid phone number"));
  assert.deepEqual(validateProfileUpdate({ phone: "" }), OK);
  assert.deepEqual(validateProfileUpdate({ phone: "  " }), OK);
  assert.deepEqual(validateProfileUpdate({ phone: " +44 20 7946 0958 " }), OK);
  assert.deepEqual(validateProfileUpdate({ phone: "12345" }), phoneError);
  assert.deepEqual(validateProfileUpdate({ phone: "1".repeat(21) }), phoneError);
  assert.deepEqual(validateProfileUpdate({ phone: "555-CALL-NOW" }), phoneError);
  assert.deepEqual(validateProfileUpdate({ company: "" }), OK);
  assert.deepEqual(validateProfileUpdate({ company: ` ${"c".repeat(60)} ` }), OK);
  assert.deepEqual(
    validateProfileUpdate({ company: "c".repeat(61) }),
    bad(err("company", "Company is too long (max 60 characters)")),
  );
});

test("profile update: an empty bio is fine and a bio is not trimmed", () => {
  assert.deepEqual(validateProfileUpdate({ bio: "" }), OK);
  assert.deepEqual(validateProfileUpdate({ bio: "x".repeat(160) }), OK);
  assert.deepEqual(validateProfileUpdate({ bio: "x".repeat(161) }), bad(err("bio", "Bio is too long (max 160 characters)")));
  assert.deepEqual(validateProfileUpdate({ bio: `${"x".repeat(160)}   ` }), bad(err("bio", "Bio is too long (max 160 characters)")));
});

test("profile update: every problem is reported, in field order", () => {
  assert.deepEqual(
    validateProfileUpdate({ email: "", username: "x", displayName: " ", phone: "x", company: "c".repeat(99), bio: "y".repeat(200) }),
    bad(
      err("email", "Email cannot be empty"),
      err("username", "Username must be 3-20 characters"),
      err("displayName", "Display name cannot be empty"),
      err("phone", "Enter a valid phone number"),
      err("company", "Company is too long (max 60 characters)"),
      err("bio", "Bio is too long (max 160 characters)"),
    ),
  );
});

// ---------- invite ----------

test("invite: email is trimmed and has its own wording for an invalid address", () => {
  assert.deepEqual(validateInvite({ ...invite, email: "  bob@example.com " }), OK);
  assert.deepEqual(validateInvite({ ...invite, email: "" }), bad(err("email", "Email is required")));
  assert.deepEqual(validateInvite({ ...invite, email: "   " }), bad(err("email", "Email is required")));
  assert.deepEqual(validateInvite({ ...invite, email: "nope" }), bad(err("email", "Enter a valid email address for the invitee")));
  assert.deepEqual(validateInvite({ ...invite, email: "a b.c@example.org" }), bad(err("email", "Enter a valid email address for the invitee")));
});

test("invite: the email limit is 254, after the format check", () => {
  assert.deepEqual(validateInvite({ ...invite, email: emailOfLength(254) }), OK);
  assert.deepEqual(
    validateInvite({ ...invite, email: emailOfLength(255) }),
    bad(err("email", "Email is too long (max 254 characters)")),
  );
  assert.deepEqual(
    validateInvite({ ...invite, email: "x".repeat(300) }),
    bad(err("email", "Enter a valid email address for the invitee")),
  );
});

test("invite: the role is an exact match", () => {
  for (const role of ["viewer", "editor", "admin"]) assert.deepEqual(validateInvite({ ...invite, role }), OK);
  assert.deepEqual(validateInvite({ ...invite, role: "" }), bad(err("role", "Role is required")));
  const unknown = bad(err("role", "Role must be viewer, editor or admin"));
  for (const role of ["owner", "Admin", " admin", "admin ", "   "]) {
    assert.deepEqual(validateInvite({ ...invite, role }), unknown, JSON.stringify(role));
  }
});

test("invite: the message is optional and trimmed before counting", () => {
  assert.deepEqual(validateInvite(invite), OK);
  assert.deepEqual(validateInvite({ ...invite, message: "" }), OK);
  assert.deepEqual(validateInvite({ ...invite, message: "m".repeat(200) }), OK);
  assert.deepEqual(validateInvite({ ...invite, message: `${"m".repeat(200)}          ` }), OK);
  assert.deepEqual(validateInvite({ ...invite, message: `   ${"m".repeat(200)}` }), OK);
  assert.deepEqual(
    validateInvite({ ...invite, message: "m".repeat(201) }),
    bad(err("message", "Message is too long (max 200 characters)")),
  );
});

test("invite: every problem is reported, in field order", () => {
  assert.deepEqual(
    validateInvite({ email: "", role: "root", message: "m".repeat(300) }),
    bad(
      err("email", "Email is required"),
      err("role", "Role must be viewer, editor or admin"),
      err("message", "Message is too long (max 200 characters)"),
    ),
  );
});

// ---------- shared behavior ----------

test("validators do not change their input", () => {
  const body = Object.freeze({ ...signup, email: "  ada@example.com ", displayName: " Ada " });
  assert.deepEqual(validateSignup(body), OK);
  const update = Object.freeze({ email: "x", username: " Y ", displayName: " Z ", bio: "w" });
  assert.equal(validateProfileUpdate(update).ok, false);
  assert.equal(update.username, " Y ");
  const inv = Object.freeze({ ...invite, email: " bob@example.com " });
  assert.deepEqual(validateInvite(inv), OK);
});

test("the route handlers still answer 200 or 422 with the same errors", () => {
  assert.deepEqual(handleSignup(signup), { status: 200, body: { created: true } });
  assert.deepEqual(handleSignup({ ...signup, username: "ada.l" }), {
    status: 422,
    body: { errors: [err("username", "Username may only contain lowercase letters, digits and underscores")] },
  });
  assert.deepEqual(handleProfileUpdate({ username: "ada.l", bio: "" }), { status: 200, body: { updated: true } });
  assert.deepEqual(handleProfileUpdate({ email: " a.b@example.org" }), {
    status: 422,
    body: { errors: [err("email", "Enter a valid email address")] },
  });
  assert.deepEqual(handleInvite({ ...invite, email: "nope" }), {
    status: 422,
    body: { errors: [err("email", "Enter a valid email address for the invitee")] },
  });
});
