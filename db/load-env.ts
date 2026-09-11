/**
 * 独立脚本环境变量加载（对齐 Next.js 加载规则与优先级）：
 *   .env → .env.local → .env.<NODE_ENV> → .env.<NODE_ENV>.local
 * 后者覆盖前者；Next 运行时（next dev/start/build）无需此模块（内置加载）。
 * 独立 tsx 脚本（db:test / db:migrate / verify / smoke）统一 import 本模块。
 */
import fs from "node:fs";
import { config } from "dotenv";

const NODE_ENV = process.env.NODE_ENV ?? "development";
const files = [".env", ".env.local", `.env.${NODE_ENV}`, `.env.${NODE_ENV}.local`];

for (const file of files) {
  if (fs.existsSync(file)) {
    config({ path: file, override: true });
  }
}
