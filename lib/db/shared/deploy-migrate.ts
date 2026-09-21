/**
 * 部署阶段迁移判定（纯逻辑，不做任何 IO）
 *
 * 背景：迁移 SQL 由本地 `npm run db:generate` 生成后入库（db/drizzle/），只有执行 migrate
 * 才会落到数据库上。线上构建只跑 `next build`，不会自动带上这一步，于是出现
 * 「新代码 + 旧 schema」（新增列/表在线上不存在 → 500）。本模块产出的判定结果
 * 由 scripts/db/migrate.ts 消费，策略见 docs/adr/0016-deploy-time-migration.md。
 *
 * 规则（自上而下匹配，先命中先返回）：
 * 1. `SKIP_DB_MIGRATE` 置位 → 不迁移（应急开关，任何环境都压得住）
 * 2. 手动模式（不带 --deploy）→ 迁移（本地 `npm run db:migrate:debug` 行为不变）
 * 3. 部署模式 + `MIGRATE_ON_DEPLOY` 置位 → 迁移（本地 / Preview / 其他 CI 想强制时用）
 * 4. 部署模式 + Vercel 生产构建 → 迁移
 * 5. 其余部署场景（本地构建、Vercel Preview / Development、其他 CI）→ 跳过
 *
 * 第 5 条针对 Preview 的理由：预览部署与生产共用同一个 Neon 数据库（同一个 DATABASE_URL），
 * 若未合并分支的 schema 变更也自动落库，会直接污染生产库。
 */
import { ENV_KEYS } from '@/lib/env/shared';

/** Vercel 注入的系统环境变量（平台环境标识，不是项目配置项） */
const VERCEL_KEYS = {
  /** 任何 Vercel 构建环境都有（含本地 `vercel build`） */
  PLATFORM: 'VERCEL',
  /** 目标环境名；自定义环境会返回其真实名字 */
  TARGET: 'VERCEL_TARGET_ENV',
  /** 旧版目标环境名；自定义环境一律返回 preview */
  TARGET_FALLBACK: 'VERCEL_ENV',
} as const;

/** Vercel 的生产环境标识 */
const PRODUCTION = 'production';

/** 真值集合：1 / true / yes / on（大小写与首尾空格不敏感），与 shell 习惯一致 */
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** 迁移调用方式：manual = 人手动执行；deploy = 由构建流程自动执行 */
export type MigrateMode = 'manual' | 'deploy';

/** 判定所需的运行环境快照（默认取 process.env，测试可注入） */
export type MigrateEnv = Record<string, string | undefined>;

export type MigrateDecision = {
  /** 本次是否执行迁移 */
  run: boolean;
  /** 判定原因，写进日志便于排查 */
  reason: string;
};

/**
 * 判定本次是否执行迁移
 *
 * @param options.mode manual = 手动执行；deploy = 部署流程调用（`--deploy`）
 * @param options.env  环境变量快照（默认 process.env）
 */
export function decideMigrate(options: { mode: MigrateMode; env?: MigrateEnv }): MigrateDecision {
  const { mode, env = process.env } = options;

  if (isEnabled(env[ENV_KEYS.SKIP_DB_MIGRATE])) {
    return { run: false, reason: `${ENV_KEYS.SKIP_DB_MIGRATE} 已置位，本次跳过迁移` };
  }

  if (mode === 'manual') {
    return { run: true, reason: '手动执行，直接迁移' };
  }

  if (isEnabled(env[ENV_KEYS.MIGRATE_ON_DEPLOY])) {
    return { run: true, reason: `${ENV_KEYS.MIGRATE_ON_DEPLOY} 已置位，强制迁移` };
  }

  const onVercel = Boolean(env[VERCEL_KEYS.PLATFORM]);
  const target = resolveVercelTarget(env);

  if (onVercel && target === PRODUCTION) {
    return { run: true, reason: 'Vercel 生产构建，自动迁移' };
  }

  const forceHint = `需要时设 ${ENV_KEYS.MIGRATE_ON_DEPLOY}=1 强制`;
  return {
    run: false,
    reason: onVercel
      ? `Vercel ${target ?? '未知'}环境不自动迁移（预览部署与生产共用数据库，避免污染生产 schema）；${forceHint}`
      : `非 Vercel 构建环境不自动迁移（本地构建不碰数据库）；本地迁移用 npm run db:migrate；${forceHint}`,
  };
}

/** 解析 Vercel 目标环境名：优先新版变量，回退旧版 */
function resolveVercelTarget(env: MigrateEnv): string | undefined {
  return env[VERCEL_KEYS.TARGET] ?? env[VERCEL_KEYS.TARGET_FALLBACK];
}

/** 环境变量是否「开启」 */
function isEnabled(value: string | undefined): boolean {
  return TRUTHY.has((value ?? '').trim().toLowerCase());
}
