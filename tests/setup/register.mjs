/**
 * Test-only module resolution for `node --test` with Node's built-in TypeScript type stripping:
 * maps the `@/…` alias to ./src/… and resolves extensionless relative imports to .ts / .tsx / index.ts,
 * the way the Next bundler does. No transpiler dependency needed (Node ≥ 22.18 / 23.6).
 */
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const EXT = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function tryFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXT) if (existsSync(base + e)) return base + e;
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:"))
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const hit = base && tryFile(base);
    return hit ? next(pathToFileURL(hit).href, context) : next(specifier, context);
  },
});
