/**
 * 数据库连通性测试：npm run db:test
 * 验证 DATABASE_URL 可用并返回数据库信息
 */
import "../db/load-env";
import postgres from "postgres";
import { env } from "../db/env";

async function main() {
  const url = env("DATABASE_URL");
  if (!url) {
    console.error("❌ 缺少环境变量 DATABASE_URL");
    console.error("   请在 .env 中配置，例如：DATABASE_URL=postgres://user:pass@host/db");
    process.exit(1);
  }

  // 脱敏打印（不泄露密码）
  const masked = url.replace(/:[^:@/]+@/, ":***@");
  console.log("连接串:", masked);

  const sql = postgres(url, { max: 1 });
  try {
    const res = await sql`select current_database() as db, current_user as usr, version() as v, now() as t`;
    console.log("✅ 数据库连接成功");
    console.log("  数据库:", res[0].db);
    console.log("  用户:", res[0].usr);
    console.log("  服务器时间:", String(res[0].t));
    console.log("  版本:", String(res[0].v).split(" on ")[0]);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("❌ 连接失败:", e.message);
  process.exit(1);
});
