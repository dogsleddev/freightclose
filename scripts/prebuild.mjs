// Build guard. The engine regenerates app/_generated/* + the portable archive
// from the raw Numeric challenge data in data/. That data is NOT redistributed,
// so it is absent from the public repo (and from CI / Vercel builds). When it is
// present (a local checkout that has it), we regenerate; when it is absent, we
// build on the committed, deterministic artifacts. Either way `next build` finds
// the JSON it imports.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

if (existsSync("data/periods.json")) {
  console.log("[prebuild] data/ present — regenerating engine artifacts + portable archive.");
  execSync("tsx engine/run.ts", { stdio: "inherit" });
  execSync("node build-portable.mjs", { stdio: "inherit" });
} else {
  console.log("[prebuild] no data/ (public/CI build) — using committed app/_generated + public artifacts.");
}
