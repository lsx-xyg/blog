import { NextRequest, NextResponse } from 'next/server';
import { getStorageDriverForPlatform, getPublicStorageDriver } from '@/lib/storage/server';
import { resolveMediaPlatform } from '@/lib/media/server';

/**
 * 站内图片路由（统一图片入口）
 *
 * GET /m/{storageKey}  例：/m/2026/09/uuid.jpg
 *
 * 设计：文章/媒体库里存的是本路由的站内地址（永久不变），
 * 本路由按 media 表记录的 **入库时平台**（storageDriver）解析对应存储档案，
 * 实时拼出真实访问 URL 并**流式代理**图片字节。
 *
 * 平台解析（升级到档案池后的兼容核心）：
 * - media 表存了 storageDriver（LOCAL / GITHUB / S3——WEBDAV 只能绑私有通道，
 *   公开入口这里不会遇到）→ 在档案池里找该平台的档案
 *   （优先绑定到公开通道的那个），历史图片跟着入库时的平台走，
 *   后台新增/切换任何档案都不影响已有图片
 * - media 表查不到（极老数据）→ 回退当前公开通道配置
 *
 * 为什么是代理而不是 302：
 * next/image 优化器对站内 URL 不发网络请求，而是在进程内 mock 一个请求
 * 调用本路由并收集响应 body（见 next/dist/server/image-optimizer.js 的
 * fetchInternalImage），302 空响应会被判定为
 * '"url" parameter is valid but internal response is invalid'（400）。
 * 所以站内图片入口必须返回图片字节。浏览器原生 <img> 同样直接拿到 200。
 *
 * 容错：服务端回源失败（如本地 dev 时服务器网络不通，但浏览器挂了代理可达）
 * 时退回 302，浏览器侧 <img> 仍可自行跟随重定向救急。
 *
 * 缓存：
 * - 响应：storageKey 含 uuid、内容不可变，成功时一年 immutable
 * - 平台反查：resolveMediaPlatform 进程内缓存 5 分钟（key → 平台不可变，TTL 只为省查询）
 */

export const dynamic = 'force-dynamic';

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const SHORT_CACHE = 'public, max-age=300';

function redirect(target: string) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: target, 'Cache-Control': SHORT_CACHE },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const storageKey = (key ?? []).join('/');

  // 基础合法性检查：非空、无路径穿越片段
  if (!storageKey || storageKey.includes('..') || storageKey.startsWith('/')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 按入库时平台解析档案；查不到/未收录时回退当前公开通道
  const platform = await resolveMediaPlatform(storageKey);
  const driver =
    (platform ? await getStorageDriverForPlatform(platform, 'public') : null) ??
    (await getPublicStorageDriver());

  let target: string;
  try {
    target = driver.getUrl(storageKey);
  } catch (error) {
    // 档案缺公开域名等配置问题：直接 404，避免无限重定向
    console.error('[/m] 拼接访问 URL 失败:', error);
    return new NextResponse('Upstream Unavailable', { status: 404 });
  }

  // 本地驱动等返回相对路径（同源静态文件）：浏览器同源 302 跟随没有问题
  if (target.startsWith('/')) {
    return redirect(target);
  }

  // 外部 CDN / 图床：服务端回源并流式返回
  try {
    const upstream = await fetch(target, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        // 部分 CDN / 反代要求 UA
        'User-Agent': 'Mozilla/5.0 (compatible; blog-media/1.0)',
        Accept: 'image/*,*/*',
      },
    });

    if (!upstream.ok || !upstream.body) {
      // 回源失败：退回 302，让浏览器用自己的网络环境尝试直连
      return redirect(target);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': IMMUTABLE_CACHE,
        ...(upstream.headers.get('etag') ? { ETag: upstream.headers.get('etag') as string } : {}),
      },
    });
  } catch {
    // 超时 / 网络错误：同上退回 302
    return redirect(target);
  }
}
