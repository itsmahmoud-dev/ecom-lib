#!/usr/bin/env bun
import path from "path";
import fs from "fs/promises";

const srcDir = path.join(import.meta.dir, "src");

const targetDir = path.join(process.cwd(), "src", "store");

await fs.cp(srcDir, targetDir, { recursive: true });
