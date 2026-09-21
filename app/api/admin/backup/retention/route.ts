import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/admin/server';
import { getBackupSettings, setSettingsBatch } from '@/lib/settings/server';
import { registry } from '@/lib/settings/shared/registry';
import { pruneBackups } from '@/lib/backup/server';
import { normalizeRetention } from '@/lib/backup/shared/retention';

/**
 * 备份保留策略 API
 *
 * GET  /api/admin/backup/retention - 读取当前策略（0 = 不限制）
 * PUT  /api/admin/backup/retention - 保存策略（只落库，不会立刻删备份）
 * POST /api/admin/backup/retention - 按当前策略立即清理一次
 *
 * 设计取舍：保存策略不触发删除，避免「点了保存就丢历史文件」这种惊吓；
 * 自动清理挂在创建备份之后（手动与定时都覆盖），另外提供「立即清理」手动触发。
 */

const RETENTION_KEYS = [
  { setting: registry['backup.retentionDays'].key, field: 'retentionDays' },
  { setting: registry['backup.retentionCount'].key, field: 'retentionCount' },
] as const;

/** 读取当前策略 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json({ retention: await getBackupSettings() });
  } catch (error) {
    console.error('获取备份保留策略失败：', error);
    return apiError('获取失败', 500);
  }
}

/** 保存策略 */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    // 非法值统一归 0（不限制），前端表单与服务端共用同一套归一化规则
    const retention = normalizeRetention({
      retentionDays: body.retentionDays,
      retentionCount: body.retentionCount,
    });

    await setSettingsBatch(
      RETENTION_KEYS.map(({ setting, field }) => ({ key: setting, value: retention[field] })),
    );

    return NextResponse.json({ success: true, retention });
  } catch (error) {
    console.error('保存备份保留策略失败：', error);
    return apiError('保存失败', 500);
  }
}

/** 按当前策略立即清理一次 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const result = await pruneBackups();
    return NextResponse.json({ ...result, deletedCount: result.deleted.length });
  } catch (error) {
    console.error('清理旧备份失败：', error);
    return apiError('清理失败', 500);
  }
}
