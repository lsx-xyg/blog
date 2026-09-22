import { NextRequest, NextResponse } from 'next/server';

/**
 * IndexNow 密钥文件：/（根）{key}.txt → API 路由
 *
 * 协议要求密钥文件位于站点根目录（https://{host}/{key}.txt），
 * 但密钥存在 DB、部署平台文件系统只读，无法在构建期写静态文件；
 * 而 next.config rewrites 在本版 Next 有两个坑（自定义正则 source 不生效、
 * destination 查询串被丢弃），故改用 middleware 内部改写。
 *
 * matcher 先粗筛（hex 字符 + .txt，排除了 robots.txt / llms.txt 等含非 hex
 * 字符的文件名），middleware 内再用严格正则校验，不匹配直接放行，
 * 对其他路径零影响。
 */
export const config = {
  matcher: ['/([0-9a-f]+\\.txt)'],
};

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 严格校验：8~128 位十六进制 + .txt（IndexNow 密钥文件格式）
  if (!/^[0-9a-f]{8,128}\.txt$/.test(pathname.slice(1))) {
    return NextResponse.next();
  }

  // 改写到带路径参数的 API 路由（app/api/indexnow/[keyfile]/route.ts），
  // 不依赖查询串（rewrites 的查询串会丢，middleware 改写路径参数可靠）
  const url = req.nextUrl.clone();
  url.pathname = `/api/indexnow${pathname}`;
  url.search = '';
  return NextResponse.rewrite(url);
}
