import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";

const url = env("DATABASE_URL");
if (!url) {
  throw new Error("缺少环境变量 DATABASE_URL（可在 .env 中配置，Neon 控制台获取）");
}

/**
 * 数据库连接单例（解决 Next.js 开发模式热重载导致连接泄漏）
 *
 * 问题：开发模式下每次文件修改都会重新加载模块，创建新的 postgres 客户端，
 * 旧连接没有释放，累积后超过数据库连接限制（"too many clients already"）。
 *
 * 解决方案：使用 globalThis 缓存连接实例，热重载时复用已有连接。
 * 生产环境中模块只加载一次，不会有这个问题。
 */
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
  sqlClient: ReturnType<typeof postgres> | undefined;
};

// 应用运行时使用 pooled 连接（Neon -pooler），迁移用 DATABASE_URL_UNPOOLED（见 neon-postgres skill）
// max: 5 控制连接池大小，避免超过 Neon 免费版连接限制
// prepare: false 禁用预编译语句（Neon serverless/PgBouncer 不支持）
// idle_timeout: 连接空闲 30 秒后自动释放
const client =
  globalForDb.sqlClient ??
  postgres(url, { max: 5, prepare: false, idle_timeout: 30 });

const db = globalForDb.db ?? drizzle(client);

// 开发环境下缓存到 global，避免热重载创建新连接
if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
  globalForDb.sqlClient = client;
}

export { db };
export { client as sql };
