import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/admin/server';
import { getSettingsBundle, applySettingsPatch } from '@/lib/settings/server';
import { resetStorageDriver } from '@/lib/storage/server';

/**
 * 站点设置 API（C9 薄壳：领域逻辑在 lib/settings/service.ts）
 * GET /api/admin/settings - 获取所有设置（敏感字段只出 configured 布尔）
 * PUT /api/admin/settings - 批量更新设置（字段分类 + 加密编排）
 */

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await getSettingsBundle());
  } catch (error) {
    console.error('获取设置失败：', error);
    return apiError('获取失败', 500);
  }
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    await applySettingsPatch(body);
    // 存储驱动实例缓存在模块级 Map 里（按档案名 + 按旧版驱动类型各一份），
    // 配置变更后必须重置，否则后台改 cdnBase/owner/token 等字段在进程重启前都不会生效。
    // 注意：档案池（storage/profiles）与通道绑定（storage/bindings）的写入接口
    // 各自也会调 resetStorageDriver()，这里的重置只负责旧版 storage.* 配置改动。
    resetStorageDriver();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新设置失败：', error);
    return apiError('更新失败', 500);
  }
}
