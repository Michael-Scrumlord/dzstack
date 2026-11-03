// Validators for the public forms. Each returns every problem it finds, at most
// one per field (the first rule that fails), in the order the fields appear below.
//
// The three differ in a few places on purpose, and the mobile app and the
// support dashboard rely on that: see "Where the three differ" in README.md.

export interface FieldError {
  field: string;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; errors: FieldError[] };

export interface SignupInput {
  email: string;
  username: string;
  displayName?: string;
  password: string;
  phone?: string;
  company?: string;
  acceptTerms: boolean;
}

export interface ProfileUpdateInput {
  email?: string;
  username?: string;
  displayName?: string;
  phone?: string;
  company?: string;
  bio?: string;
}

export interface InviteInput {
  email: string;
  role: string;
  message?: string;
}

export function validateSignup(input: SignupInput): ValidationResult {
  const errors: FieldError[] = [];

  // Email: trimmed, at most 254 characters.
  const email = input.email.trim();
  if (email === "") {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else if (email.length > 254) {
    errors.push({ field: "email", message: "Email is too long (max 254 characters)" });
  }

  // Username: trimmed, lowercase letters, digits and underscores.
  const username = input.username.trim();
  if (username === "") {
    errors.push({ field: "username", message: "Username is required" });
  } else if (username.length < 3 || username.length > 20) {
    errors.push({ field: "username", message: "Username must be 3-20 characters" });
  } else if (!/^[a-z0-9_]+$/.test(username)) {
    errors.push({ field: "username", message: "Username may only contain lowercase letters, digits and underscores" });
  }

  // Display name: optional here, a blank one is ignored.
  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    if (displayName !== "" && displayName.length > 40) {
      errors.push({ field: "displayName", message: "Display name is too long (max 40 characters)" });
    }
  }

  // Password: never trimmed, spaces count.
  const password = input.password;
  if (password === "") {
    errors.push({ field: "password", message: "Password is required" });
  } else if (password.length < 10) {
    errors.push({ field: "password", message: "Password must be at least 10 characters" });
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.push({ field: "password", message: "Password needs a letter and a digit" });
  }

  // Phone: optional here, trimmed, a blank one is ignored.
  if (input.phone !== undefined) {
    const phone = input.phone.trim();
    if (phone !== "" && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      errors.push({ field: "phone", message: "Enter a valid phone number" });
    }
  }

  // Company: optional, trimmed, at most 60 characters.
  if (input.company !== undefined) {
    const company = input.company.trim();
    if (company.length > 60) {
      errors.push({ field: "company", message: "Company is too long (max 60 characters)" });
    }
  }

  if (!input.acceptTerms) {
    errors.push({ field: "acceptTerms", message: "You must accept the terms" });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateProfileUpdate(input: ProfileUpdateInput): ValidationResult {
  const errors: FieldError[] = [];

  // Every field is optional: undefined means "leave it as it is".

  // Email: NOT trimmed here (a stray space is reported), at most 120 characters.
  if (input.email !== undefined) {
    const email = input.email;
    if (email === "") {
      errors.push({ field: "email", message: "Email cannot be empty" });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: "email", message: "Enter a valid email address" });
    } else if (email.length > 120) {
      errors.push({ field: "email", message: "Email is too long (max 120 characters)" });
    }
  }

  // Username: trimmed; dots are allowed (accounts imported from the old forum).
  if (input.username !== undefined) {
    const username = input.username.trim();
    if (username === "") {
      errors.push({ field: "username", message: "Username cannot be empty" });
    } else if (username.length < 3 || username.length > 20) {
      errors.push({ field: "username", message: "Username must be 3-20 characters" });
    } else if (!/^[a-z0-9_.]+$/.test(username)) {
      errors.push({
        field: "username",
        message: "Username may only contain lowercase letters, digits, underscores and dots",
      });
    }
  }

  // Display name: trimmed; blank is an error here.
  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    if (displayName === "") {
      errors.push({ field: "displayName", message: "Display name cannot be empty" });
    } else if (displayName.length > 40) {
      errors.push({ field: "displayName", message: "Display name is too long (max 40 characters)" });
    }
  }

  // Phone: trimmed; an empty one is fine (it clears the number).
  if (input.phone !== undefined) {
    const phone = input.phone.trim();
    if (phone !== "" && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      errors.push({ field: "phone", message: "Enter a valid phone number" });
    }
  }

  // Company: trimmed, at most 60 characters; empty is fine (it clears the company).
  if (input.company !== undefined) {
    const company = input.company.trim();
    if (company.length > 60) {
      errors.push({ field: "company", message: "Company is too long (max 60 characters)" });
    }
  }

  // Bio: not trimmed; empty is fine (it clears the bio).
  if (input.bio !== undefined) {
    if (input.bio.length > 160) {
      errors.push({ field: "bio", message: "Bio is too long (max 160 characters)" });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateInvite(input: InviteInput): ValidationResult {
  const errors: FieldError[] = [];

  // Email: trimmed, at most 254 characters, and its own wording for "invalid".
  const email = input.email.trim();
  if (email === "") {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address for the invitee" });
  } else if (email.length > 254) {
    errors.push({ field: "email", message: "Email is too long (max 254 characters)" });
  }

  // Role: exact match, not trimmed.
  const role = input.role;
  if (role === "") {
    errors.push({ field: "role", message: "Role is required" });
  } else if (role !== "viewer" && role !== "editor" && role !== "admin") {
    errors.push({ field: "role", message: "Role must be viewer, editor or admin" });
  }

  // Message: optional, trimmed before counting.
  if (input.message !== undefined) {
    const message = input.message.trim();
    if (message.length > 200) {
      errors.push({ field: "message", message: "Message is too long (max 200 characters)" });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
