/**
 * 后台布局：统一处理认证逻辑
 * - 路由不匹配 adminPath → 404 伪装（防探测）
 * - 未登录 → 跳转到登录页
 * - 非管理员 → 404 伪装
 */
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getAdminPathAsync } from "@/lib/shared/admin-path";
import { isAdminUser } from "@/lib/shared/utils";

export const dynamic = "force-dynamic";

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

  // 检查登录状态
  const session = await auth.api.getSession({ headers: await headers() });

  // 未登录 → 跳转到后台首页（那里有登录表单）
  if (!session) {
    redirect(`/${adminPath}`);
  }

  // 非管理员 → 404 伪装
  if (!isAdminUser(session.user)) notFound();

  return <>{children}</>;
}
