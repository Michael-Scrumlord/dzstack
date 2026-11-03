// A hand-built team used by the API tests. Two orgs, six projects in org 1.
//
// org 1 users:  1 Ada (owner), 2 Ben (admin), 3 Cara (member), 4 Dev (member), 5 Eli (guest),
//               6 Fay (deactivated), 8 Hana (member), 9 Ivan (member)
// org 2 user:   7 Gus (owner)
// tokens:       tok-ada, tok-ben, tok-cara, tok-dev, tok-eli, tok-gus
import { FakeDb } from "../src/db/fake.ts";

const t = (day: string, time = "09:00:00") => `2026-${day}T${time}Z`;

export function smallTeam(): FakeDb {
  return new FakeDb({
    users: [
      { id: 1, name: "Ada", email: "ada@example.com", deactivated_at: null },
      { id: 2, name: "Ben", email: "ben@example.com", deactivated_at: null },
      { id: 3, name: "Cara", email: "cara@example.com", deactivated_at: null },
      { id: 4, name: "Dev", email: "dev@example.com", deactivated_at: null },
      { id: 5, name: "Eli", email: "eli@example.com", deactivated_at: null },
      { id: 6, name: "Fay", email: "fay@example.com", deactivated_at: t("01-15") },
      { id: 7, name: "Gus", email: "gus@example.com", deactivated_at: null },
      { id: 8, name: "Hana", email: "hana@example.com", deactivated_at: null },
      { id: 9, name: "Ivan", email: "ivan@example.com", deactivated_at: null },
    ],
    sessions: [
      { id: 1, token: "tok-ada", user_id: 1, org_id: 1, role: "owner" },
      { id: 2, token: "tok-ben", user_id: 2, org_id: 1, role: "admin" },
      { id: 3, token: "tok-cara", user_id: 3, org_id: 1, role: "member" },
      { id: 4, token: "tok-dev", user_id: 4, org_id: 1, role: "member" },
      { id: 5, token: "tok-eli", user_id: 5, org_id: 1, role: "guest" },
      { id: 6, token: "tok-gus", user_id: 7, org_id: 2, role: "owner" },
    ],
    projects: [
      { id: 1, org_id: 1, key: "PAY", name: "Payments", description: "Card and invoice flows", visibility: "org", pinned: true, archived: false, created_at: t("01-05"), updated_at: t("03-01", "10:00:00") },
      { id: 2, org_id: 1, key: "apollo", name: "apollo", description: "Mobile app", visibility: "org", pinned: false, archived: false, created_at: t("01-10"), updated_at: t("02-10") },
      { id: 3, org_id: 1, key: "BIL", name: "Billing", description: "Dunning and credit notes", visibility: "private", pinned: false, archived: false, created_at: t("01-12"), updated_at: t("01-12") },
      { id: 4, org_id: 1, key: "ARC24", name: "Archive 2024", description: "", visibility: "org", pinned: false, archived: true, created_at: t("01-01"), updated_at: t("01-02") },
      { id: 5, org_id: 1, key: "site", name: "website", description: "Marketing site", visibility: "private", pinned: false, archived: false, created_at: t("01-20"), updated_at: t("02-01") },
      { id: 6, org_id: 1, key: "ZEP", name: "Zephyr", description: "Spike", visibility: "org", pinned: false, archived: false, created_at: t("02-01"), updated_at: t("02-01") },
      { id: 7, org_id: 2, key: "PAY", name: "Payments", description: "Other org", visibility: "org", pinned: false, archived: false, created_at: t("01-06"), updated_at: t("01-06") },
    ],
    project_members: [
      { id: 1, project_id: 1, user_id: 1, role: "owner" },
      { id: 2, project_id: 1, user_id: 2, role: "admin" },
      { id: 3, project_id: 1, user_id: 3, role: "editor" },
      { id: 4, project_id: 1, user_id: 4, role: "viewer" },
      { id: 5, project_id: 1, user_id: 5, role: "viewer" },
      { id: 6, project_id: 1, user_id: 6, role: "editor" },
      { id: 7, project_id: 1, user_id: 8, role: "viewer" },
      { id: 8, project_id: 1, user_id: 9, role: "viewer" },
      { id: 9, project_id: 2, user_id: 3, role: "owner" },
      { id: 10, project_id: 3, user_id: 1, role: "owner" },
      { id: 11, project_id: 3, user_id: 3, role: "editor" },
      { id: 12, project_id: 5, user_id: 4, role: "owner" },
      { id: 13, project_id: 5, user_id: 5, role: "viewer" },
      { id: 14, project_id: 7, user_id: 7, role: "owner" },
    ],
    tags: [
      { id: 1, org_id: 1, label: "backend", color: "blue", archived: false },
      { id: 2, org_id: 1, label: "Frontend", color: null, archived: false },
      { id: 3, org_id: 1, label: "urgent", color: "red", archived: true },
      { id: 4, org_id: 1, label: "q3", color: "green", archived: false },
      { id: 5, org_id: 2, label: "backend", color: "blue", archived: false },
    ],
    project_tags: [
      { id: 1, project_id: 1, tag_id: 1 },
      { id: 2, project_id: 1, tag_id: 2 },
      { id: 3, project_id: 1, tag_id: 3 },
      { id: 4, project_id: 2, tag_id: 4 },
      { id: 5, project_id: 3, tag_id: 1 },
      { id: 6, project_id: 5, tag_id: 2 },
      { id: 7, project_id: 7, tag_id: 5 },
    ],
    activity: [
      { id: 1, project_id: 1, actor_id: 1, kind: "created", at: t("01-05") },
      { id: 2, project_id: 1, actor_id: 3, kind: "comment", at: t("03-01", "10:00:00") },
      { id: 3, project_id: 1, actor_id: 4, kind: "view", at: t("03-02", "08:00:00") },
      { id: 4, project_id: 2, actor_id: 6, kind: "updated", at: t("02-10") },
      { id: 5, project_id: 5, actor_id: null, kind: "file_added", at: t("02-01") },
    ],
  });
}
