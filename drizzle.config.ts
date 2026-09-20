// 与 Next.js 加载规则对齐：.env → .env.local → .env.<NODE_ENV> → .env.<NODE_ENV>.local
import "@/lib/env/server/load";
import { defineConfig } from "drizzle-kit";
import { getEnv } from "@/lib/env/server";

// 迁移必须走非池化（direct）连接串（neon-postgres skill：pooled 不支持 session 级操作）
export default defineConfig({
  dialect: "postgresql",
  schema: "@/db/schema.ts",
  out: "@/db/drizzle",
  dbCredentials: {
    url: getEnv("DATABASE_URL_UNPOOLED") ?? getEnv("DATABASE_URL") ?? "",
  },
});
