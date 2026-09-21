/**
 * 后台布局：统一处理认证逻辑
 * - 路由不匹配 adminPath → 404 伪装（防探测）
 * - 未登录且不是后台首页 → 跳转到后台首页（有登录表单）
 * - 未登录但是后台首页 → 直接渲染（后台首页自己显示登录表单）
 * - 非管理员 → 404 伪装
 */
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { getAdminPathAsync } from '@/lib/admin/server';
import { isAdminUser } from '@/lib/shared';
import { GuideManager } from '@/components/guides/guide-manager';

export const dynamic = 'force-dynamic';

/**
 * 后台整域 noindex：robots.txt 公开可见，自定义 adminSlug 不能写进 Disallow
 * （等于泄露后台入口），改用 metadata 让搜索引擎不收录任何后台页面。
 */
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = await getAdminPathAsync();

  // 路由不匹配 → 404 伪装（不返回 403/302，防探测）
  if (adminSlug !== adminPath) notFound();

  // 获取当前请求的路径，判断是否是后台首页
  // Next.js 可能使用不同的请求头来传递路径，这里尝试多种可能
  const headersList = await headers();
  const pathname =
    headersList.get('x-next-pathname') ||
    headersList.get('x-pathname') ||
    headersList.get('x-invoke-path') ||
    headersList.get('referer')?.split('/').slice(3).join('/') ||
    '';
  const isAdminHome =
    pathname === `/${adminPath}` ||
    pathname === `/${adminPath}/` ||
    pathname === adminPath ||
    pathname === '';

  // 检查登录状态
  const session = await auth.api.getSession({ headers: headersList });

  // 未登录：
  // - 如果是后台首页，直接渲染（后台首页自己显示登录表单）
  // - 如果是其他页面，跳转到后台首页
  if (!session) {
    if (!isAdminHome) {
      redirect(`/${adminPath}`);
    }
    return <>{children}</>;
  }

  // 非管理员 → 404 伪装
  if (!isAdminUser(session.user)) notFound();

  // 引导管理器（onborda 懒加载）：仅登录管理员渲染
  return <GuideManager>{children}</GuideManager>;
}
