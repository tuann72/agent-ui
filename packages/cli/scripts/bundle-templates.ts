/**
 * Regenerates templates/ from registry/src. Runs under Bun in this repo only —
 * wired into `bun run build` and npm's prepack, so every published tarball
 * carries a fresh snapshot (invariant 1: templates are bundled inside the
 * versioned CLI, never downloaded at init time). templates/ and dist/ are
 * generated artifacts: gitignored, never edited by hand.
 */

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isTemplateFile } from "../src/lib";

const cliRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const registrySrc = join(repoRoot, "registry", "src");
const templatesRoot = join(cliRoot, "templates");
const dest = join(templatesRoot, "agent");

rmSync(templatesRoot, { recursive: true, force: true });

let count = 0;
const visit = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      visit(full);
      continue;
    }
    const rel = relative(registrySrc, full);
    if (!isTemplateFile(rel)) continue;
    const target = join(dest, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(full, target);
    count++;
  }
};
visit(registrySrc);

if (count < 10) {
  throw new Error(
    `Bundled only ${count} template files from ${registrySrc} — wrong path or empty registry?`,
  );
}

// The registry's dependency ranges ride along so init can never drift from
// what the source actually needs.
const registryPkg = JSON.parse(
  readFileSync(join(repoRoot, "registry", "package.json"), "utf8"),
) as { dependencies: Record<string, string> };
writeFileSync(
  join(templatesRoot, "manifest.json"),
  JSON.stringify({ dependencies: registryPkg.dependencies }, null, 2) + "\n",
);

console.log(`Bundled ${count} template files from registry/src (+ manifest.json).`);
