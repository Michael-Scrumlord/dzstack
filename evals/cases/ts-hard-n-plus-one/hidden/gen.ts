// Deterministic datasets for the hidden checks. Edge cases are planted on purpose:
// names that tie ignoring case, % _ \ inside names, deactivated and missing accounts,
// archived and colourless tags, ties on timestamps, projects with no relations at all.
import type { ActivityRow, OrgRole, ProjectMemberRow, ProjectRole, ProjectRow, ProjectTagRow, SessionRow, TagRow, UserRow } from "../src/db/schema.ts";
import { FakeDb } from "../src/db/fake.ts";

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["alpha", "Alpha", "ALPHA", "beta", "Beta", "Gamma", "delta", "Delta", "100% uptime", "a_b", "axb", "a%b", "back\\slash", "Ünïcode", "ünïcode", "Zeta", "zeta", "x", "Billing", "billing portal", "Mobile", "website"];
const USER_NAMES = ["anna", "Anna", "ANNA", "bob", "Bob", "Cy", "dee", "Dee", "Éloïse", "zed", "Zed"];
const TAG_LABELS = ["backend", "Backend", "BACKEND", "frontend", "front_end", "100%", "urgent", "q3", "Q3", "design", "infra", "ops", "a\\b"];
const KINDS = ["comment", "updated", "file_added", "member_added", "view", "view", "view", "created", "archived"];
const ROLES: ProjectRole[] = ["owner", "admin", "editor", "editor", "viewer", "viewer", "viewer", "viewer"];

export const TOKENS = {
  owner: "tok-owner",
  admin: "tok-admin",
  member: "tok-member",
  member2: "tok-member2",
  lonely: "tok-lonely",
  guest: "tok-guest",
  guestNone: "tok-guest-none",
  otherOrg: "tok-other-org",
  emptyOrg: "tok-empty-org",
} as const;

export function makeTeam(options: { projects: number; seed: number; users?: number }): FakeDb {
  const rand = rng(options.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const chance = (p: number) => rand() < p;
  const day = (n: number) => new Date(Date.UTC(2025, 0, 1 + n, 8, 0, 0)).toISOString().replace(".000", "");
  const moment = (n: number, s: number) => new Date(Date.UTC(2025, 0, 1 + n, 8, s % 60, 0)).toISOString().replace(".000", "");

  const userCount = options.users ?? Math.max(60, options.projects);
  const users: UserRow[] = [];
  for (let i = 1; i <= userCount + 2; i++) {
    users.push({
      id: i,
      name: i % 7 === 0 ? pick(USER_NAMES) : `${pick(USER_NAMES)} ${i % 13}`,
      email: `u${i}@example.com`,
      deactivated_at: i > 8 && chance(0.12) ? day(200) : null,
    });
  }
  const otherOrgUser = userCount + 1;
  const emptyOrgUser = userCount + 2;
  const session = (id: number, token: string, user_id: number, org_id: number, role: OrgRole): SessionRow => ({ id, token, user_id, org_id, role });
  const sessions = [
    session(1, TOKENS.owner, 1, 1, "owner"),
    session(2, TOKENS.admin, 2, 1, "admin"),
    session(3, TOKENS.member, 3, 1, "member"),
    session(4, TOKENS.member2, 4, 1, "member"),
    session(5, TOKENS.guest, 5, 1, "guest"),
    session(6, TOKENS.guestNone, 6, 1, "guest"),
    session(7, TOKENS.lonely, 8, 1, "member"),
    session(8, TOKENS.otherOrg, otherOrgUser, 2, "owner"),
    session(9, TOKENS.emptyOrg, emptyOrgUser, 3, "owner"),
  ];

  const tags: TagRow[] = TAG_LABELS.map((label, i) => ({
    id: i + 1,
    org_id: 1,
    label,
    color: chance(0.35) ? null : pick(["blue", "red", "green", "amber"]),
    archived: label === "urgent" || chance(0.1),
  }));
  tags.push({ id: tags.length + 1, org_id: 2, label: "backend", color: "blue", archived: false });
  const otherOrgTag = tags.length;

  const projects: ProjectRow[] = [];
  const members: ProjectMemberRow[] = [];
  const projectTags: ProjectTagRow[] = [];
  const activity: ActivityRow[] = [];
  const deactivated = users.filter((u) => u.deactivated_at).map((u) => u.id);

  for (let i = 1; i <= options.projects + 25; i++) {
    const org = i <= options.projects ? 1 : 2;
    const base = pick(NAMES);
    const name = chance(0.45) ? base : `${base} ${i}`;
    const created = between(0, 40);
    projects.push({
      id: i,
      org_id: org,
      key: chance(0.3) ? base.toUpperCase().slice(0, 6) + i : `${base.toLowerCase().replace(/\s+/g, "-")}-${i % 9}`,
      name,
      description: "",
      visibility: chance(0.3) ? "private" : "org",
      pinned: chance(0.06),
      archived: chance(0.1),
      created_at: day(created),
      updated_at: day(created + between(0, 5)),
    });

    // members: none, all deactivated, or a mix
    const roll = rand();
    const wanted = roll < 0.05 ? 0 : between(1, 12);
    const seen = new Set<number>();
    for (let m = 0; m < wanted; m++) {
      const uid = roll > 0.05 && roll < 0.09 && deactivated.length ? pick(deactivated) : between(1, userCount);
      if (seen.has(uid)) continue;
      seen.add(uid);
      members.push({ id: members.length + 1, project_id: i, user_id: uid, role: pick(ROLES) });
    }
    // some private projects of org 1 include the test viewers, so visibility has something to find
    if (org === 1 && i % 11 === 0) members.push({ id: members.length + 1, project_id: i, user_id: 5, role: "viewer" });
    if (org === 1 && i % 13 === 0 && !seen.has(3)) members.push({ id: members.length + 1, project_id: i, user_id: 3, role: "editor" });
    if (org === 1 && i % 17 === 0 && !seen.has(4)) members.push({ id: members.length + 1, project_id: i, user_id: 4, role: "owner" });

    // tags: none, only retired ones, or a mix (case variants of one label can sit on the same project)
    const tagWanted = chance(0.2) ? 0 : between(1, 6);
    const tagSeen = new Set<number>();
    for (let t = 0; t < tagWanted; t++) {
      const tid = org === 2 ? otherOrgTag : between(1, TAG_LABELS.length);
      if (tagSeen.has(tid)) continue;
      tagSeen.add(tid);
      projectTags.push({ id: projectTags.length + 1, project_id: i, tag_id: tid });
    }
    if (org === 1 && i % 19 === 0) {
      for (const tid of [1, 2, 3]) if (!tagSeen.has(tid)) projectTags.push({ id: projectTags.length + 1, project_id: i, tag_id: tid });
    }

    // activity: none, only page views, or a mix with timestamp ties and odd actors
    const kind = rand();
    const events = kind < 0.12 ? 0 : between(1, 30);
    for (let e = 0; e < events; e++) {
      const k = kind < 0.2 ? "view" : pick(KINDS);
      const actorRoll = rand();
      const actor = actorRoll < 0.07 ? null : actorRoll < 0.13 ? userCount + 900 + e : actorRoll < 0.25 && deactivated.length ? pick(deactivated) : between(1, userCount);
      activity.push({ id: activity.length + 1, project_id: i, actor_id: actor, kind: k, at: moment(created + between(0, 12), between(0, 3) * 20) });
    }
  }
  return new FakeDb({ users, sessions, projects, project_members: members, tags, project_tags: projectTags, activity });
}

/** An independent copy of a database's rows (the same data, separate state). */
export function cloneDb(db: FakeDb): FakeDb {
  return new FakeDb(structuredClone(db.tables));
}
