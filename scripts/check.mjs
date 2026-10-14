#!/usr/bin/env node
// Structural check for dzstack. Run before every commit: node scripts/check.mjs
// Exits 1 and lists every problem; prints one line when clean.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const problems = [];
const add = (msg) => problems.push(msg);
const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const frontmatter = (path) => {
  const text = readFileSync(path, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  // folded descriptions (`description: >-` then indented lines)
  if (/^(>-?|\|-?)$/.test(fields.description ?? "")) {
    fields.description = match[1].split("description:")[1].split("\n").slice(1).filter((l) => /^\s/.test(l)).join(" ").trim();
  }
  return fields;
};

const skillsDir = join(root, "skills");
const skills = readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory());
const skillSet = new Set(skills);

for (const skill of skills) {
  const path = join(skillsDir, skill, "SKILL.md");
  if (!existsSync(path)) { add(`${skill}: no SKILL.md`); continue; }
  const fm = frontmatter(path);
  if (!fm) { add(`${skill}: no frontmatter`); continue; }
  if (fm.name !== skill) add(`${skill}: name "${fm.name}" must equal the folder name`);
  if (!kebab.test(skill)) add(`${skill}: folder name must be kebab-case`);
  if (!fm.description) add(`${skill}: no description`);
  else if (fm.description.length > 1024) add(`${skill}: description is ${fm.description.length} chars (max 1024)`);
  const hidden = fm["disable-model-invocation"] === "true";
  const codexPolicy = join(skillsDir, skill, "agents", "openai.yaml");
  const codexHidden = existsSync(codexPolicy) && /allow_implicit_invocation:\s*false/.test(readFileSync(codexPolicy, "utf8"));
  if (hidden !== codexHidden) add(`${skill}: disable-model-invocation (${hidden}) and agents/openai.yaml allow_implicit_invocation:false (${codexHidden}) must agree, or Codex lists it in every session`);
}

for (const agent of readdirSync(join(root, "agents")).filter((f) => f.endsWith(".md"))) {
  const fm = frontmatter(join(root, "agents", agent));
  if (!fm?.name || !fm.description) add(`agents/${agent}: needs name and description`);
  else if (fm.name !== agent.replace(/\.md$/, "")) add(`agents/${agent}: name "${fm.name}" must equal the file name`);
}

const markdown = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (entry.endsWith(".md")) markdown.push(path);
  }
};
walk(root);

const playbooks = readdirSync(join(skillsDir, "daz-mode", "playbooks"));
for (const path of markdown) {
  const text = readFileSync(path, "utf8");
  const where = path.slice(root.length + 1);
  for (const [, name] of text.matchAll(/`(principle-[a-z0-9-]+)`/g)) if (!skillSet.has(name)) add(`${where}: names missing skill ${name}`);
  for (const [, name] of text.matchAll(/skills\/([a-z0-9-]+)\//g)) if (!skillSet.has(name)) add(`${where}: names missing skill ${name}`);
  for (const [, file] of text.matchAll(/playbooks\/([a-z0-9-]+\.md)/g)) if (!playbooks.includes(file)) add(`${where}: names missing playbook ${file}`);
  for (const [, file] of text.matchAll(/references\/([a-z0-9-]+\.md)/g)) {
    const skill = where.startsWith("skills/") ? where.split("/")[1] : null;
    const candidates = skill ? [join(skillsDir, skill, "references", file)] : skills.map((s) => join(skillsDir, s, "references", file));
    if (!candidates.some((c) => existsSync(c))) add(`${where}: names missing reference ${file}`);
  }
  for (const [, link] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (/^(https?:|mailto:|~|\/)/.test(link) || link.includes("${")) continue;
    if (!existsSync(normalize(join(dirname(path), link)))) add(`${where}: broken link ${link}`);
  }
}

const router = readFileSync(join(skillsDir, "daz-mode", "SKILL.md"), "utf8");
for (const file of playbooks) if (!router.includes(`playbooks/${file}`)) add(`daz-mode router: playbook ${file} is unreachable (not in the router)`);
for (const skill of skills.filter((s) => s.startsWith("principle-"))) if (!router.includes(`\`${skill}\``)) add(`daz-mode principles index: ${skill} is missing`);

if (problems.length) {
  console.log(problems.map((p) => `- ${p}`).join("\n"));
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`ok: ${skills.length} skills, ${playbooks.length} playbooks, every reference resolves`);
