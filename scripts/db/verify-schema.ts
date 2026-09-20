import '@/lib/env/server/load';
import postgres from 'postgres';
import { ENV_KEYS } from '@/lib/env/shared';
import { getEnv } from '@/lib/env/server';

async function main() {
  const databaseUrl = getEnv(ENV_KEYS.DATABASE_URL_UNPOOLED) ?? getEnv(ENV_KEYS.DATABASE_URL);
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL_UNPOOLED 和 DATABASE_URL 都未配置');
    process.exit(1);
  }
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const tables =
      await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`;
    const types =
      await sql`select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e' order by t.typname`;
    const enumVals =
      await sql`select t.typname, e.enumlabel from pg_type t join pg_enum e on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e' order by t.typname, e.enumsortorder`;
    const isAdmin =
      await sql`select column_name from information_schema.columns where table_name='user' and column_name='isAdmin'`;

    // 枚举值按类型分组
    const enumMap = new Map<string, string[]>();
    for (const row of enumVals) {
      if (!enumMap.has(row.typname)) enumMap.set(row.typname, []);
      enumMap.get(row.typname)!.push(row.enumlabel);
    }
    console.log('─'.repeat(50));
    console.log(`表 (${tables.length}): ${tables.map((r) => r.table_name).join(', ')}`);

    console.log('─'.repeat(50));
    console.log(`枚举类型 (${types.length}):`);
    for (const [name, labels] of enumMap) {
      console.log(`  ${name}: ${labels.join(', ')}`);
    }

    console.log('─'.repeat(50));
    console.log(
      `user.isAdmin 列: ${isAdmin.length ? `✅ 存在 (${isAdmin[0].data_type})` : '❌ 缺失'}`,
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
