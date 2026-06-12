import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const cjsDir = join(process.cwd(), "dist", "cjs");
const jsPath = join(cjsDir, "index.js");
const cjsPath = join(cjsDir, "index.cjs");

if (!existsSync(jsPath)) {
  throw new Error(`Expected CommonJS build output at ${jsPath}`);
}

renameSync(jsPath, cjsPath);
