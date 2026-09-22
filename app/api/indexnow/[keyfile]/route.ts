import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/settings/server';

export const dynamic = 'force-dynamic';

/**
 * IndexNow 密钥文件（站点所有权校验）。
 *
 * 两个入口殊途同归：
 * - 根路径 https://{host}/{key}.txt —— 协议规范位置，由 middleware.ts
 *   内部改写到本路由（{key}.txt 作为路径参数）
 * - 直连 /api/indexnow/{key}.txt —— 调试 / 排查用
 *
 * 只有路径密钥与库中配置（seo.indexnow_key）一致才返回 200；
 * 其余一律 404（不泄露密钥是否有效）。密钥本身是公开值
 * （引擎就是要抓它做校验），泄露无风险。
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ keyfile: string }> }) {
  const { keyfile } = await params;
  const key = keyfile.endsWith('.txt') ? keyfile.slice(0, -4) : keyfile;

  if (!/^[0-9a-f]{8,128}$/.test(key)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const configured = await getConfig('seo.indexNowKey');
  if (configured !== key) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return new NextResponse(key, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // 密钥基本不变，允许引擎短暂缓存
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
