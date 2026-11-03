// Reproduce a slow page against a generated team and print what it would cost in production.
//   node scripts/profile.ts            a team of 250 projects
//   node scripts/profile.ts 600        a team of 600 projects
import { createApp } from "../src/api/app.ts";
import { generateTeam } from "../testkit/generate.ts";
import { client } from "../testkit/client.ts";

const projects = Number(process.argv[2] ?? 250);
const db = generateTeam({ projects });
const api = client(createApp(db), "tok-member");

for (const [label, query] of [
  ["first page ", { page: "1", perPage: "50" }],
  ["second page", { page: "2", perPage: "50" }],
] as const) {
  db.resetStats();
  const res = await api.get("/projects", query);
  const body = res.body as { items: unknown[]; total: number };
  console.log(
    `${label}: ${body.items.length} of ${body.total} projects, ${db.stats.queries} queries, ` +
      `${db.stats.rowsRead} rows, ${(db.stats.simulatedMs / 1000).toFixed(2)} s simulated`,
  );
}
