import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, apiError } from '@/lib/admin/server';
import { listProfilesFull } from '@/lib/storage/server';
import { createDriverInstance } from '@/lib/storage/server';
import { profileMissingFields } from '@/lib/storage/server';

/**
 * 存储档案连通性测试 API
 * POST /api/admin/storage/test  body: {name}
 *
 * 四步全测，不落 media 表：
 *   1. upload   —— 写一行探针
 *   2. download —— 读回来逐字节比对（私有通道没有公开 URL，读写往返才算真连通）
 *   3. delete   —— 回收探针（**成功失败都会执行**，早期版本放在 upload 之后，
 *                  一旦前面抛错就跳过，远端会堆积孤儿文件）
 *   4. 收尾     —— 删除失败不影响"可读写"的结论，但会作为警告返回：
 *                  权限不完整时媒体/备份删除会失败并留下垃圾，值得让用户知道
 *
 * 关于 getUrl：它是同步纯函数，只在「需要公开 URL」时有意义。
 * 私有通道档案（WebDAV、未配 publicBase 的 S3）抛出"不支持公开访问 URL"是**预期行为**，
 * 不参与连通性判定。
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { name } = (await request.json()) as { name?: string };
    if (!name) return apiError('缺少 name 参数', 400);

    const profiles = await listProfilesFull();
    const profile = profiles.find((p) => p.name === name);
    if (!profile) return apiError(`档案「${name}」不存在`, 404);

    const missing = profileMissingFields(profile.driver, profile.config);
    if (missing.length > 0) {
      return NextResponse.json({ success: false, error: `缺少必填字段：${missing.join('、')}` });
    }

    const driver = createDriverInstance(profile.driver, profile.config);
    const probe = Buffer.from(`storage-probe-${Date.now()}`);
    const started = Date.now();

    // 公开档案展示可访问 URL；私有档案抛错属预期，不当失败
    let urlNote: string;
    try {
      const url = driver.getUrl('probe/ping.txt');
      urlNote = url.startsWith('/') ? '站内相对路径' : '公开 URL 已配置';
    } catch {
      urlNote = '私有通道（无公开 URL）';
    }

    // 1. 上传（失败直接抛到外层 catch）
    const uploaded = await driver.upload(probe, 'storage-probe.txt', 'text/plain');

    // 2. 读回校验
    let readbackError = '';
    try {
      const roundTrip = await driver.download(uploaded.key);
      if (!roundTrip.equals(probe)) {
        readbackError = `读回内容不一致（写入 ${probe.length} 字节，读回 ${roundTrip.length} 字节）`;
      }
    } catch (e) {
      readbackError = e instanceof Error ? e.message : '下载失败';
    }

    // 3. 回收探针（无论第 2 步成败都要执行）
    let deleteError = '';
    try {
      await driver.delete(uploaded.key);
    } catch (e) {
      console.error('[storage-test] 探针删除失败：', e);
      deleteError = e instanceof Error ? e.message : '删除失败';
    }

    if (readbackError) {
      return NextResponse.json({
        success: false,
        error: `${readbackError}${deleteError ? `；探针文件也未清理：${uploaded.key}` : ''}`,
      });
    }

    return NextResponse.json({
      success: true,
      latencyMs: Date.now() - started,
      urlNote: `${urlNote}，${
        deleteError ? '上传 / 下载正常，但删除失败' : '上传 / 下载 / 删除往返正常'
      }`,
      steps: { upload: true, download: true, delete: !deleteError },
      cleanupWarning: deleteError
        ? `删除失败（${deleteError}）：该档案可能没有删除权限，探针文件未清理：${uploaded.key}`
        : undefined,
    });
  } catch (error) {
    console.error('存储连通性测试失败：', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '测试失败',
    });
  }
}
