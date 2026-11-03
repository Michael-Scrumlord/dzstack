// Run from the project root: no anchored pattern (/^...$/) may be written twice in the sources,
// since the copy-pasted patterns are the duplication the task is about.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const seen = new Map();
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts")) {
      const code = readFileSync(p, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      for (const m of code.matchAll(/\/\^(?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\n\[\\])*\$\/[a-z]*/g)) {
        seen.set(m[0], (seen.get(m[0]) ?? 0) + 1);
      }
    }
  }
})(join(process.cwd(), "src"));

const repeated = [...seen].filter(([, n]) => n > 1);
if (repeated.length) {
  for (const [re, n] of repeated) console.log(`${re} is written ${n} times`);
  process.exit(1);
}
console.log(`${seen.size} distinct patterns, each written once`);
