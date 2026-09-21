import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/admin/server';
import {
  listProfileViews,
  getChannelBindings,
  upsertProfile,
  deleteProfile,
  type ProfileConfig,
} from '@/lib/storage/server';
import { resetStorageDriver } from '@/lib/storage/server';
import type { StorageDriverType } from '@/lib/types/storage';

/**
 * 存储档案池 API
 * GET    /api/admin/storage/profiles - 档案列表（敏感字段只出 configured 布尔）+ 通道绑定
 * POST   /api/admin/storage/profiles - 创建/覆盖档案 {name, driver, config}
 * DELETE /api/admin/storage/profiles?name=xxx - 删除档案（被绑定时报错）
 */

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const [profiles, bindings] = await Promise.all([listProfileViews(), getChannelBindings()]);
    return NextResponse.json({ profiles, bindings });
  } catch (error) {
    console.error('获取存储档案失败：', error);
    return apiError('获取失败', 500);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      name?: string;
      driver?: StorageDriverType;
      config?: ProfileConfig;
    };
    if (!body.name || !body.driver || !body.config) {
      return apiError('缺少 name / driver / config', 400);
    }
    await upsertProfile({
      name: body.name,
      driver: body.driver,
      config: body.config,
    });
    resetStorageDriver();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存存储档案失败：', error);
    return apiError(error instanceof Error ? error.message : '保存失败', 400);
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const name = new URL(request.url).searchParams.get('name');
    if (!name) return apiError('缺少 name 参数', 400);
    await deleteProfile(name);
    resetStorageDriver();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除存储档案失败：', error);
    return apiError(error instanceof Error ? error.message : '删除失败', 400);
  }
}
