import { describe, expect, it } from 'vitest';
import { decideMigrate } from './deploy-migrate';
import type { MigrateEnv } from './deploy-migrate';

/** Vercel 生产构建环境快照 */
const VERCEL_PROD: MigrateEnv = { VERCEL: '1', VERCEL_ENV: 'production' };
/** Vercel 预览构建环境快照 */
const VERCEL_PREVIEW: MigrateEnv = { VERCEL: '1', VERCEL_ENV: 'preview' };
/** 本地环境快照（只保留项目自家变量，避免被宿主环境干扰） */
const LOCAL: MigrateEnv = {};

/** 判定「部署模式」下的结果 */
function deploy(env: MigrateEnv) {
  return decideMigrate({ mode: 'deploy', env });
}

describe('decideMigrate：手动模式', () => {
  it('手动执行照旧迁移（本地 npm run db:migrate:debug 行为不变）', () => {
    expect(decideMigrate({ mode: 'manual', env: LOCAL }).run).toBe(true);
  });

  it('SKIP_DB_MIGRATE 置位时跳过', () => {
    expect(decideMigrate({ mode: 'manual', env: { SKIP_DB_MIGRATE: '1' } }).run).toBe(false);
  });
});

describe('decideMigrate：Vercel 构建', () => {
  it('生产构建自动迁移', () => {
    expect(deploy(VERCEL_PROD).run).toBe(true);
  });

  it('自定义环境名为 production 时同样迁移（优先读 VERCEL_TARGET_ENV）', () => {
    expect(deploy({ VERCEL: '1', VERCEL_TARGET_ENV: 'production' }).run).toBe(true);
  });

  it('预览构建跳过（与生产共用数据库）', () => {
    expect(deploy(VERCEL_PREVIEW).run).toBe(false);
  });

  it('开发构建跳过', () => {
    expect(deploy({ VERCEL: '1', VERCEL_ENV: 'development' }).run).toBe(false);
  });

  it('自定义环境（staging）跳过', () => {
    expect(deploy({ VERCEL: '1', VERCEL_TARGET_ENV: 'staging' }).run).toBe(false);
  });

  it('只有 VERCEL 没有目标环境名时保守跳过', () => {
    expect(deploy({ VERCEL: '1' }).run).toBe(false);
  });

  it('本地构建（无 VERCEL）跳过', () => {
    expect(deploy(LOCAL).run).toBe(false);
  });
});

describe('decideMigrate：开关优先级', () => {
  it('MIGRATE_ON_DEPLOY 让本地构建也迁移', () => {
    expect(deploy({ MIGRATE_ON_DEPLOY: '1' }).run).toBe(true);
  });

  it('MIGRATE_ON_DEPLOY 让预览构建也迁移', () => {
    expect(deploy({ ...VERCEL_PREVIEW, MIGRATE_ON_DEPLOY: '1' }).run).toBe(true);
  });

  it('SKIP_DB_MIGRATE 压过 MIGRATE_ON_DEPLOY 与生产构建', () => {
    expect(deploy({ ...VERCEL_PROD, MIGRATE_ON_DEPLOY: '1', SKIP_DB_MIGRATE: '1' }).run).toBe(
      false,
    );
  });

  it.each(['1', 'true', 'TRUE', 'yes', 'on', ' 1 '])('真值写法 %j 视为开启', (value) => {
    expect(deploy({ ...VERCEL_PREVIEW, MIGRATE_ON_DEPLOY: value }).run).toBe(true);
  });

  it.each(['0', 'false', 'no', ''])('非真值 %j 不开启强制，回落环境判定', (value) => {
    expect(deploy({ ...VERCEL_PREVIEW, MIGRATE_ON_DEPLOY: value }).run).toBe(false);
    expect(deploy({ ...VERCEL_PROD, MIGRATE_ON_DEPLOY: value }).run).toBe(true);
  });
});

describe('decideMigrate：判定原因', () => {
  it('任何分支都给出非空原因，便于构建日志排查', () => {
    const cases = [
      decideMigrate({ mode: 'manual', env: LOCAL }),
      decideMigrate({ mode: 'manual', env: { SKIP_DB_MIGRATE: '1' } }),
      deploy(VERCEL_PROD),
      deploy(VERCEL_PREVIEW),
      deploy(LOCAL),
      deploy({ MIGRATE_ON_DEPLOY: '1' }),
    ];
    for (const decision of cases) {
      expect(decision.reason.length).toBeGreaterThan(0);
    }
  });
});
