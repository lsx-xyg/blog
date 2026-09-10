import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";

const url = env("DATABASE_URL");
if (!url) {
  throw new Error("缺少环境变量 DATABASE_URL（可在 .env 中配置，Neon 控制台获取）");
}

// 应用运行时使用 pooled 连接（Neon -pooler），迁移用 DATABASE_URL_UNPOOLED（见 neon-postgres skill）
const client = postgres(url, { max: 10, prepare: false });

export const db = drizzle(client);
export { client as sql };
