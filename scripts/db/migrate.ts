/**
 * 数据库迁移（本地手动 + 部署自动，见 docs/adr/0016-deploy-time-migration.md）
 *
 * 用法：
 *   npm run db:migrate:debug    # 本地手动，直接迁移
 *   npm run db:migrate:deploy   # 部署入口（`npm run build` 会调用），按环境判定是否迁移
 *
 * 相比 `drizzle-kit migrate` 多做的事：
 * - 失败时打印原始错误（CLI 有时只报一句 "migration failed"）
 * - 执行前按 decideMigrate() 判定环境：本地构建 / Vercel 预览构建默认跳过
 * - 迁移期间持有 PG 咨询锁，两次构建并发时只有一个真正执行，另一个等它做完再判定
 * - 连接失败退避重试，容忍 Neon 冷启动
 * - 读取 drizzle 迁移表前后差值，日志里给出「本次应用了几个」
 */
import '@/lib/env/server/load';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { ENV_KEYS } from '@/lib/env/shared';
import { getEnv } from '@/lib/env/server';
import { decideMigrate } from '@/lib/db/shared/deploy-migrate';

/** postgres 客户端类型（从工厂函数推导，避免依赖包内部的类型名字） */
type SqlClient = ReturnType<typeof postgres>;

/** 迁移文件目录（相对仓库根目录，npm script 的 cwd 就是根目录） */
const MIGRATIONS_FOLDER = './db/drizzle';

/** 跨构建互斥用的咨询锁 key（项目内唯一即可） */
const ADVISORY_LOCK_KEY = 8010001;

/** 咨询锁最长等待时间：另一次构建可能正在迁移，等它做完即可 */
const LOCK_WAIT_MS = 60_000;
const LOCK_RETRY_MS = 1_000;

/** 连接重试（Neon 冷启动偶发首次连接失败） */
const CONNECT_TRIES = 3;
const CONNECT_RETRY_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(): Promise<void> {
  const url = getEnv(ENV_KEYS.DATABASE_URL_UNPOOLED) ?? getEnv(ENV_KEYS.DATABASE_URL);
  if (!url) {
    console.error(`❌ 缺少 ${ENV_KEYS.DATABASE_URL_UNPOOLED} 或 ${ENV_KEYS.DATABASE_URL}`);
    process.exitCode = 1;
    return;
  }
  if (!getEnv(ENV_KEYS.DATABASE_URL_UNPOOLED)) {
    console.warn(
      `⚠️  未配置 ${ENV_KEYS.DATABASE_URL_UNPOOLED}，回退到池化连接；Neon 上迁移建议走直连（可能失败）`,
    );
  }

  // max: 1 → 咨询锁与迁移共用同一条连接；prepare: false → 连接池（PgBouncer）不支持预编译语句
  const sql = postgres(url, { max: 1, prepare: false });

  try {
    await connect(sql);

    if (!(await acquireLock(sql))) {
      console.warn(
        `⚠️  等待 ${LOCK_WAIT_MS / 1000}s 仍未取得迁移锁（另一次构建正在迁移），本次跳过`,
      );
      return;
    }

    try {
      const before = await appliedCount(sql);
      console.log('⏳ 执行迁移...');
      await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
      const applied = (await appliedCount(sql)) - before;
      console.log(
        applied > 0 ? `✅ 迁移完成，本次应用 ${applied} 个` : '✅ 数据库已是最新，无需迁移',
      );
    } finally {
      await releaseLock(sql);
    }
  } catch (e) {
    console.error('❌ 迁移失败：', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

/** 连接探活：失败退避重试 */
async function connect(sql: SqlClient): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`select 1`;
      return;
    } catch (e) {
      if (attempt >= CONNECT_TRIES) throw e;
      const wait = CONNECT_RETRY_MS * attempt;
      console.warn(`⚠️  数据库连接失败（第 ${attempt}/${CONNECT_TRIES} 次），${wait}ms 后重试`);
      await sleep(wait);
    }
  }
}

/** 尝试取得咨询锁（有界等待，避免两次构建互相阻塞） */
async function acquireLock(sql: SqlClient): Promise<boolean> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    const rows = await sql<
      { locked: boolean }[]
    >`select pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) as locked`;
    if (rows[0]?.locked) return true;
    if (Date.now() >= deadline) return false;
    await sleep(LOCK_RETRY_MS);
  }
}

/** 释放咨询锁（连接已断开时忽略：锁随会话结束自动释放） */
async function releaseLock(sql: SqlClient): Promise<void> {
  try {
    await sql`select pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  } catch {
    // 忽略：会话结束锁自然释放
  }
}

/** 已应用的迁移数（drizzle 自建的迁移表；首次迁移时该表还不存在 → 0） */
async function appliedCount(sql: SqlClient): Promise<number> {
  try {
    const rows = await sql<
      { count: string }[]
    >`select count(*)::text as count from drizzle.__drizzle_migrations`;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

// ---- 入口：先按环境判定要不要迁移，再执行 ----
const decision = decideMigrate({ mode: process.argv.includes('--deploy') ? 'deploy' : 'manual' });

if (!decision.run) {
  console.log(`⏭️  跳过数据库迁移：${decision.reason}`);
  process.exit(0);
}

console.log(`▶️  执行数据库迁移：${decision.reason}`);

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error('❌ 迁移中止：', e instanceof Error ? e.message : e);
    process.exit(1);
  });
