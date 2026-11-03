// Run from the project root: the public surface of src/validators.ts must be what it was.
// Functions are checked at runtime (names, arity); the types, which node erases, by reading the source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const mod = await import(pathToFileURL(join(root, "src/validators.ts")).href);
const problems = [];

for (const name of ["validateSignup", "validateProfileUpdate", "validateInvite"]) {
  if (typeof mod[name] !== "function") problems.push(`${name} is not an exported function`);
  else if (mod[name].length !== 1) problems.push(`${name} takes ${mod[name].length} parameters, expected 1`);
  else if (mod[name].name !== name) problems.push(`${name}.name is ${JSON.stringify(mod[name].name)}`);
}

const sources = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts")) sources.push(readFileSync(p, "utf8"));
  }
})(join(root, "src"));
const all = sources.join("\n");
const validators = readFileSync(join(root, "src/validators.ts"), "utf8");

// Same parameter type and return type as before (the parameter's name may change; the code may have moved,
// since the runtime check above already proved validators.ts exports the function).
const signatures = { validateSignup: "SignupInput", validateProfileUpdate: "ProfileUpdateInput", validateInvite: "InviteInput" };
for (const [fn, input] of Object.entries(signatures)) {
  const re = new RegExp(`(?:function\\s+${fn}\\s*\\(|const\\s+${fn}\\s*(?::[^=]+)?=\\s*\\()\\s*\\w+\\s*:\\s*${input}\\s*\\)\\s*:\\s*ValidationResult`);
  if (!re.test(all)) problems.push(`${fn}(input: ${input}): ValidationResult is no longer declared`);
}

// The exported types are still exported from validators.ts: declared there, or re-exported by it.
for (const t of ["FieldError", "ValidationResult", "SignupInput", "ProfileUpdateInput", "InviteInput"]) {
  const declared = new RegExp(`export\\s+(?:interface|type)\\s+${t}\\b`);
  const named = new RegExp(`export\\s+(?:type\\s+)?\\{[^}]*\\b${t}\\b[^}]*\\}\\s+from`);
  const ok = declared.test(validators) || named.test(validators) || (/export\s+\*\s+from/.test(validators) && declared.test(all));
  if (!ok) problems.push(`type ${t} is no longer exported from src/validators.ts`);
}

if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}
console.log("exports and signatures unchanged");
