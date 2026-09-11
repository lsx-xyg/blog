import "../db/load-env";
import postgres from "postgres";
import { env } from "../db/env";

async function main() {
  const sql = postgres(env("DATABASE_URL_UNPOOLED") ?? env("DATABASE_URL")!, { max: 1 });
  const tables = await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`;
  const types = await sql`select typname from pg_type where typname in ('post_status','backup_trigger') order by typname`;
  const enumVals = await sql`select t.typname, e.enumlabel from pg_type t join pg_enum e on t.oid=e.enumtypid where t.typname in ('post_status','backup_trigger') order by t.typname, e.enumsortorder`;
  const isAdmin = await sql`select column_name from information_schema.columns where table_name='user' and column_name='isAdmin'`;
  console.log("表 (", tables.length, "):", tables.map(r => r.table_name).join(", "));
  console.log("枚举类型:", types.map(r => r.typname).join(", "));
  console.log("枚举值:", enumVals.map(r => `${r.typname}=${r.enumlabel}`).join(" | "));
  console.log("user.isAdmin 列:", isAdmin.length ? "✅ 存在" : "❌ 缺失");
  await sql.end();
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
