// A deterministic team of any size, for profiling and for tests that need volume.
// Tokens: tok-owner (org owner), tok-admin, tok-member, tok-guest. All in org 1.
import { FakeDb } from "../src/db/fake.ts";
import type { ActivityRow, OrgRole, ProjectMemberRow, ProjectRole, ProjectRow, ProjectTagRow, TagRow, UserRow } from "../src/db/schema.ts";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ["Atlas", "Beacon", "Cobalt", "Delta", "Ember", "Falcon", "Granite", "Harbor", "Iris", "Juniper", "Kestrel", "Lumen"];
const KINDS = ["comment", "updated", "file_added", "member_added", "view", "view"];
const ROLES: ProjectRole[] = ["owner", "admin", "editor", "viewer", "viewer", "viewer"];

export function generateTeam(options: { projects: number; seed?: number }): FakeDb {
  const rand = rng(options.seed ?? 7);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const day = (n: number, s = 0) => new Date(Date.UTC(2025, 0, 1 + n, 8, 0, s)).toISOString().replace(".000", "");

  const userCount = Math.max(30, Math.round(options.projects / 2));
  const users: UserRow[] = Array.from({ length: userCount }, (_, i) => ({
    id: i + 1,
    name: `${pick(WORDS)} ${String.fromCharCode(65 + (i % 26))}${i}`,
    email: `user${i + 1}@example.com`,
    deactivated_at: i > 4 && rand() < 0.08 ? day(300) : null,
  }));
  const tags: TagRow[] = Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    org_id: 1,
    label: `${pick(WORDS).toLowerCase()}-${i}`,
    color: rand() < 0.3 ? null : pick(["blue", "red", "green", "amber"]),
    archived: rand() < 0.1,
  }));

  const projects: ProjectRow[] = [];
  const members: ProjectMemberRow[] = [];
  const projectTags: ProjectTagRow[] = [];
  const activity: ActivityRow[] = [];
  for (let i = 1; i <= options.projects; i++) {
    const created = between(0, 300);
    projects.push({
      id: i,
      org_id: 1,
      key: `P${i}`,
      name: `${pick(WORDS)} ${pick(WORDS)} ${i}`,
      description: "",
      visibility: rand() < 0.25 ? "private" : "org",
      pinned: rand() < 0.03,
      archived: rand() < 0.05,
      created_at: day(created),
      updated_at: day(created + between(0, 60)),
    });
    for (const uid of new Set(Array.from({ length: between(2, 9) }, () => between(1, userCount)))) {
      members.push({ id: members.length + 1, project_id: i, user_id: uid, role: pick(ROLES) });
    }
    for (const tid of new Set(Array.from({ length: between(0, 4) }, () => between(1, tags.length)))) {
      projectTags.push({ id: projectTags.length + 1, project_id: i, tag_id: tid });
    }
    for (let a = between(3, 25); a > 0; a--) {
      activity.push({ id: activity.length + 1, project_id: i, actor_id: rand() < 0.05 ? null : between(1, userCount), kind: pick(KINDS), at: day(created + a, a) });
    }
  }
  const session = (id: number, token: string, user_id: number, role: OrgRole) => ({ id, token, user_id, org_id: 1, role });
  return new FakeDb({
    users,
    tags,
    projects,
    project_members: members,
    project_tags: projectTags,
    activity,
    sessions: [session(1, "tok-owner", 1, "owner"), session(2, "tok-admin", 2, "admin"), session(3, "tok-member", 3, "member"), session(4, "tok-guest", 4, "guest")],
  });
}
