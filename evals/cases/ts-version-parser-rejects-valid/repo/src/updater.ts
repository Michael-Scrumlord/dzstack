import { compareVersions, tryParseVersion, type Version } from "./semver.ts";

export interface PickOptions {
  /** Consider pre-releases such as 2.1.0-rc.1. Default: false. */
  includePrerelease?: boolean;
}

export interface Pick {
  /** The newest tag, as it was given, or null when nothing qualifies. */
  newest: string | null;
  /** Tags that are not valid versions. */
  skipped: string[];
}

// Release tags are usually written v1.4.0; the version itself has no prefix.
function stripV(tag: string): string {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

export function pickNewest(tags: readonly string[], options: PickOptions = {}): Pick {
  const skipped: string[] = [];
  let best: { tag: string; version: Version } | null = null;
  for (const tag of tags) {
    const version = tryParseVersion(stripV(tag));
    if (!version) {
      skipped.push(tag);
      continue;
    }
    if (!options.includePrerelease && version.prerelease.length > 0) continue;
    if (best === null || compareVersions(version, best.version) > 0) best = { tag, version };
  }
  return { newest: best === null ? null : best.tag, skipped };
}

export function findUpdate(current: string, tags: readonly string[], options: PickOptions = {}): string | null {
  const { newest } = pickNewest(tags, options);
  if (newest === null) return null;
  return compareVersions(stripV(newest), stripV(current)) > 0 ? newest : null;
}
