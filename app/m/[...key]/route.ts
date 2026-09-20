import { NextRequest, NextResponse } from 'next/server';
import { getPublicStorageDriver } from '@/lib/storage/server';

/**
 * 站内图片路由（统一图片入口）
 *
 * GET /m/{storageKey}  例：/m/2026/09/uuid.jpg
 *
 * 设计：文章/媒体库里存的是本路由的站内地址（永久不变），
 * 本路由按「当前」存储配置实时拼出真实访问 URL 并**流式代理**图片字节。
 * 好处：后台切换 CDN（jsDelivr / raw 直连 / 自定义加速）全站立即生效，
 * 文章内容无需改动。
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
 * - storageKey 含 uuid，内容不可变，代理成功时返回一年 immutable，
 *   浏览器和 next/image 优化器（磁盘缓存）都会长缓存
 * - 回源失败的 302 用短缓存（max-age=300），恢复后最多 5 分钟收敛
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

  const driver = await getPublicStorageDriver();
  const target = driver.getUrl(storageKey);

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
