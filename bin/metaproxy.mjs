#!/usr/bin/env node
// Native Node entrypoint for MetaProxy.
//
// Loads .env (only sets variables that are not already present), then runs the
// TypeScript source directly via Node's native type stripping (Node >= 23.6).
// No build step, no dist/, no npx tsc.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");

function loadDotEnv() {
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return; // no .env present, rely on real environment
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

await import("../src/index.ts");
