import { NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/admin/server';
import {
  setChannelBinding,
  getChannelBindings,
  listProfilesFull,
  createDriverInstance,
  resetStorageDriver,
} from '@/lib/storage/server';
import {
  STORAGE_CHANNEL_VALUES,
  STORAGE_CHANNEL_META,
  STORAGE_DRIVER_META,
} from '@/lib/storage/shared/channels';

/**
 * 存储通道绑定 API
 * GET /api/admin/storage/bindings - 当前绑定
 * PUT /api/admin/storage/bindings - 批量绑定 {upload?: name, gallery?: name, backup?: name}
 *
 * 只校验请求体里出现的通道（前端每次只提交被改动的那一个），
 * 这样 env 覆盖（STORAGE_BINDING_*）指向非档案值时不会阻塞其它通道的保存。
 *
 * 校验两条：
 * 1. 可见性——public 通道（文章/相册图片）不能绑仅私有的驱动（WebDAV 等）
 * 2. 公开 URL——public 通道的档案必须能给出公开 URL（S3/R2 需先配 publicBase），
 *    否则图片能传上去但没有可访问地址，等于传了个寂寞
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await getChannelBindings());
  } catch (error) {
    console.error('获取通道绑定失败：', error);
    return apiError('获取失败', 500);
  }
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const touched = STORAGE_CHANNEL_VALUES.filter(
      (channel) => body[channel] !== undefined && body[channel] !== null,
    );
    const profiles = touched.length > 0 ? await listProfilesFull() : [];

    for (const channel of touched) {
      const value = body[channel];
      if (typeof value !== 'string') {
        return apiError(`通道 ${STORAGE_CHANNEL_META[channel].label} 的绑定值不合法`, 400);
      }
      if (value === '') {
        // 清空 = 解除绑定，回退旧配置
        await setChannelBinding(channel, '');
        continue;
      }

      const meta = STORAGE_CHANNEL_META[channel];
      const profile = profiles.find((p) => p.name === value);
      if (!profile) return apiError(`档案「${value}」不存在`, 404);

      const driverLabel = STORAGE_DRIVER_META[profile.driver]?.label ?? profile.driver;
      const visibility = STORAGE_DRIVER_META[profile.driver]?.visibility ?? [];
      if (!visibility.includes(meta.visibility)) {
        return apiError(
          `档案「${value}」（${driverLabel}）不能用于「${meta.label}」：该通道需要${
            meta.visibility === 'public' ? '可公开访问的' : '仅服务端读写的'
          }存储，请改绑其他档案`,
          400,
        );
      }

      if (meta.visibility === 'public') {
        try {
          createDriverInstance(profile.driver, profile.config).getUrl('__probe__');
        } catch (e) {
          return apiError(
            `档案「${value}」缺少公开访问地址：${e instanceof Error ? e.message : '未知原因'}`,
            400,
          );
        }
      }

      await setChannelBinding(channel, value);
    }

    resetStorageDriver();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存通道绑定失败：', error);
    return apiError(error instanceof Error ? error.message : '保存失败', 400);
  }
}
