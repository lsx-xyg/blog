// 引导配置 seed 脚本
// 使用方式：npx tsx scripts/seed-guides.ts
// 幂等：guideKey 已存在则跳过（改版换新 guideKey 版本号）
import '@/lib/env/server/load';
import { getEnv } from '@/lib/env/server';
import { ENV_KEYS } from '@/lib/env/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { guiders, type NewGuider } from '@/db/schema';
import { GuideStatus, type GuideStep } from '@/lib/types/guides';

const run = async () => {
  const databaseUrl = getEnv(ENV_KEYS.DATABASE_URL_UNPOOLED) ?? getEnv(ENV_KEYS.DATABASE_URL);
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 或 DATABASE_URL_UNPOOLED 未配置');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    const steps: GuideStep[] = [
      {
        id: 'step_1',
        target: 'reveal-view',
        title: '需要先设置密码',
        content:
          '当前账号未设置密码（通过 GitHub 登录创建），敏感信息查看前需要先设置密码。点击「下一步」前往设置密码。',
        placement: 'bottom',
        nextRoute: '/account',
      },
      {
        id: 'step_2',
        target: 'account-set-password',
        title: '设置你的密码',
        content:
          '在下方填写新密码并确认（至少 8 位），设置成功后即可使用密码登录，敏感信息查看的二次验证也会随之可用。',
        placement: 'top',
      },
    ];

    const guide: NewGuider = {
      guideKey: 'reveal_password_setup_v1',
      title: '敏感信息查看：设置密码',
      page: '/settings',
      status: GuideStatus.PUBLISHED,
      targetCondition: {
        logic: 'and',
        conditions: [
          { field: 'event_click', op: 'eq', value: 'reveal-view' },
          { field: 'page', op: 'eq', value: '/settings' },
        ],
      },
      priority: 10,
      steps,
    };

    const existing = await db
      .select({ id: guiders.id })
      .from(guiders)
      .where(eq(guiders.guideKey, guide.guideKey));

    if (existing.length > 0) {
      console.log(`⏭️  ${guide.guideKey} 已存在，跳过`);
      return;
    }

    await db.insert(guiders).values(guide);
    console.log(`✅ 已创建引导：${guide.guideKey}（published，2 步）`);
  } catch (e) {
    console.error('❌ failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
};

run();
