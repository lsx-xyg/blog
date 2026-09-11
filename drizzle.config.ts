// 与 Next.js 加载规则对齐：.env → .env.local → .env.<NODE_ENV> → .env.<NODE_ENV>.local
import "./db/load-env";
import { defineConfig } from "drizzle-kit";
import { env } from "./db/env";

// 迁移必须走非池化（direct）连接串（neon-postgres skill：pooled 不支持 session 级操作）
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env("DATABASE_URL_UNPOOLED") ?? env("DATABASE_URL") ?? "",
  },
});
