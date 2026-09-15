// 编程方式的数据库迁移脚本
// 使用方式：npx tsx scripts/migrate.ts
// 优势：迁移失败时会显示真实错误，不会像 drizzle-kit CLI 那样静默吞错

import "../db/load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const run = async () => {
  // 迁移必须走非池化（direct）连接串
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL 或 DATABASE_URL_UNPOOLED 未配置");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    console.log("⏳ migrating...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ done");
  } catch (e) {
    console.error("❌ failed:", e);
    process.exit(1);
  } finally {
    await sql.end();
  }
  process.exit(0);
};

run();
