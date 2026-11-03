// Semantic Versioning 2.0.0 (https://semver.org/spec/v2.0.0.html): parsing and precedence.

export interface Version {
  major: number;
  minor: number;
  patch: number;
  /** Dot-separated pre-release identifiers, as written. Empty for a release. */
  prerelease: string[];
  /** Dot-separated build metadata identifiers, as written. */
  build: string[];
}

export class InvalidVersionError extends Error {
  input: string;

  constructor(input: string) {
    super(`not a valid semantic version: ${JSON.stringify(input)}`);
    this.name = "InvalidVersionError";
    this.input = input;
  }
}

// MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+))?(?:\+([0-9A-Za-z]+))?$/;

export function tryParseVersion(text: string): Version | null {
  const m = VERSION.exec(text);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split(".") : [],
    build: m[5] ? m[5].split(".") : [],
  };
}

export function parseVersion(text: string): Version {
  const version = tryParseVersion(text);
  if (!version) throw new InvalidVersionError(text);
  return version;
}

export function isValidVersion(text: string): boolean {
  return tryParseVersion(text) !== null;
}

export function formatVersion(v: Version): string {
  let text = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease.length > 0) text += `-${v.prerelease.join(".")}`;
  if (v.build.length > 0) text += `+${v.build.join(".")}`;
  return text;
}

type Order = -1 | 0 | 1;

export function compareVersions(a: string | Version, b: string | Version): Order {
  const x = typeof a === "string" ? parseVersion(a) : a;
  const y = typeof b === "string" ? parseVersion(b) : b;
  for (const part of ["major", "minor", "patch"] as const) {
    if (x[part] !== y[part]) return x[part] < y[part] ? -1 : 1;
  }
  return comparePrerelease(x.prerelease, y.prerelease);
}

function comparePrerelease(a: string[], b: string[]): Order {
  // A release is newer than any of its pre-releases.
  if (a.length === 0 || b.length === 0) {
    return a.length === b.length ? 0 : a.length === 0 ? 1 : -1;
  }
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) {
    const order = compareIdentifier(a[i], b[i]);
    if (order !== 0) return order;
  }
  // Everything shared is equal: the longer list is newer.
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

function compareIdentifier(a: string, b: string): Order {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb ? 0 : na < nb ? -1 : 1;
  if (!Number.isNaN(na)) return -1; // numbers sort before words
  if (!Number.isNaN(nb)) return 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

export function sortVersions(list: readonly string[]): string[] {
  return [...list].sort((a, b) => compareVersions(a, b));
}
