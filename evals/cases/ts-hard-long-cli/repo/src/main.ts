#!/usr/bin/env node
import { run } from "./cli.ts";

const code = await run(process.argv.slice(2), {
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
  env: process.env,
});
process.exitCode = code;
