#!/usr/bin/env node
// Structural check for dzstack. Run before every commit: node scripts/check.mjs
// Exits 1 and lists every problem; prints one line when clean.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { execFileSync } from "node:child_process";

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

// Size budgets (#90): frontmatter is loaded in every session's skill listing, so it fails CI.
// Bodies load only when a skill is invoked, so an over-budget body warns instead.
// Budgets are bytes, in the same style as agent-guide's scripts/check.py.
const DESC_MAX = 400, FM_MAX = 600, BODY_WARN = 8000;
const BODY_EXEMPT = new Set(["daz-mode"]); // the router: its playbook/principle indexes live in the body
const warnings = [];
const bytes = (s) => Buffer.byteLength(s, "utf8");

for (const skill of skills) {
  const path = join(skillsDir, skill, "SKILL.md");
  if (!existsSync(path)) { add(`${skill}: no SKILL.md`); continue; }
  const text = readFileSync(path, "utf8");
  const fm = frontmatter(path);
  if (!fm) { add(`${skill}: no frontmatter`); continue; }
  if (fm.name !== skill) add(`${skill}: name "${fm.name}" must equal the folder name`);
  if (!kebab.test(skill)) add(`${skill}: folder name must be kebab-case`);
  if (!fm.description) add(`${skill}: no description`);
  else if (bytes(fm.description) > DESC_MAX) add(`${skill}: description is ${bytes(fm.description)} bytes (budget ${DESC_MAX}): shorten it; it is loaded in every session`);
  const fmBlock = text.match(/^---\n([\s\S]*?)\n---\n/)?.[0] ?? "";
  if (bytes(fmBlock) > FM_MAX) add(`${skill}: frontmatter is ${bytes(fmBlock)} bytes (budget ${FM_MAX}): move detail into the body or a reference`);
  if (!BODY_EXEMPT.has(skill) && bytes(text) > BODY_WARN) warnings.push(`${skill}: SKILL.md body is ${bytes(text)} bytes (soft budget ${BODY_WARN}): consider moving detail into references/`);
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
const bannedPatterns = [
  { re: /udzstack/i, label: "corrupted search-and-replace token 'udzstack'" },
  { re: /git show origin\/main:(?:dzstack\/)?skills\//, label: "repo-coupled 'git show origin/main:...skills/'" },
  { re: /configured fast model \(e\.g\. per setup-dzstack\)/, label: "unresolved placeholder 'configured fast model (e.g. per setup-dzstack)'" },
  { re: /poteto-mode-tools/, label: "legacy package name 'poteto-mode-tools'" },
];

for (const path of markdown) {
  const text = readFileSync(path, "utf8");
  const where = path.slice(root.length + 1);
  for (const [, name] of text.matchAll(/[`*]{1,2}(principle-[a-z0-9-]+)[`*]{1,2}/g)) {
    if (!skillSet.has(name)) add(`${where}: names missing skill ${name}`);
  }
  for (const [, name] of text.matchAll(/\*\*([a-z0-9-]+)\*\*\s+principle\s+skill/g)) {
    if (!name.startsWith("principle-")) add(`${where}: unprefixed principle skill reference "**${name}**" (use "principle-${name}")`);
  }
  for (const [, name] of text.matchAll(/(?:^|[^a-z0-9_-])skills\/([a-z0-9-]+)\//g)) {
    if (!skillSet.has(name)) add(`${where}: names missing skill ${name}`);
  }
  for (const [, file] of text.matchAll(/playbooks\/([a-z0-9-]+\.md)/g)) {
    if (!playbooks.includes(file)) add(`${where}: names missing playbook ${file}`);
  }
  for (const [, targetSkill, file] of text.matchAll(/(?:\.\.\/([a-z0-9-]+)\/)?references\/([a-z0-9-]+\.md)/g)) {
    const skill = targetSkill ?? (where.startsWith("skills/") ? where.split("/")[1] : null);
    const candidates = skill ? [join(skillsDir, skill, "references", file)] : skills.map((s) => join(skillsDir, s, "references", file));
    if (!candidates.some((c) => existsSync(c))) add(`${where}: names missing reference ${targetSkill ? `../${targetSkill}/` : ""}references/${file}`);
  }
  for (const [, link] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (/^(https?:|mailto:|~|\/)/.test(link) || link.includes("${")) continue;
    if (!existsSync(normalize(join(dirname(path), link)))) add(`${where}: broken link ${link}`);
  }
  for (const { re, label } of bannedPatterns) {
    if (re.test(text)) add(`${where}: contains ${label}`);
  }
}

const codeFiles = [];
const walkCode = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walkCode(path);
    else if (/\.(ts|mjs|sh|json|lock)$/.test(entry) && path !== new URL(import.meta.url).pathname) codeFiles.push(path);
  }
};
walkCode(root);
for (const path of codeFiles) {
  const text = readFileSync(path, "utf8");
  const where = path.slice(root.length + 1);
  for (const { re, label } of bannedPatterns) {
    if (re.test(text)) add(`${where}: contains ${label}`);
  }
}

// The pack ships generic: no owner names or home-infrastructure hosts. Only the plugin author line may name a person.
const ownerTokens = /michael|sirius|scrumlord|fretfulalloy|mikestand/i;
const ownerAllow = {
  ".cursor-plugin/plugin.json": ['"name": "Michael Daza"'],
  "evals/arms.json": ["\"plugin\": \"git+https://github.com/michael-denyer/pstack-claude.git@513c0886b79abb04065293581a4ef7e70049e4f2:plugins/pstack\","], // pstack-claude's own author, not the owner
};
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
for (const where of tracked) {
  if (where === "scripts/check.mjs" || !existsSync(join(root, where))) continue;
  const allowed = ownerAllow[where] ?? [];
  readFileSync(join(root, where), "utf8").split("\n").forEach((line, i) => {
    if (ownerTokens.test(line) && !allowed.some((a) => line.trim() === a)) add(`${where}:${i + 1}: names the owner or their setup; dzstack ships generic`);
  });
}

const sickoAgent =readFileSync(join(root, "agents", "comment-sicko.md"), "utf8");
const sickoRef = readFileSync(join(skillsDir, "no-comments", "references", "comment-sicko.md"), "utf8");
if (sickoAgent !== sickoRef) add("agents/comment-sicko.md and skills/no-comments/references/comment-sicko.md are out of sync");

const router = readFileSync(join(skillsDir, "daz-mode", "SKILL.md"), "utf8");
for (const file of playbooks) if (!router.includes(`playbooks/${file}`)) add(`daz-mode router: playbook ${file} is unreachable (not in the router)`);
for (const skill of skills.filter((s) => s.startsWith("principle-"))) if (!router.includes(`\`${skill}\``)) add(`daz-mode principles index: ${skill} is missing`);

for (const w of warnings) console.log(`warning: ${w}`);
if (problems.length) {
  console.log(problems.map((p) => `- ${p}`).join("\n"));
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`ok: ${skills.length} skills, ${playbooks.length} playbooks, every reference and hygiene gate clean`);
