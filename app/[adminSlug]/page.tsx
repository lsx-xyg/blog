/** 后台根路径：路由不匹配一律 404 伪装；用户表为空 → 引导页；未登录 → 登录页；非管理员 → 404 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAdminPathAsync } from "@/lib/admin-path";
import { isAdminUser } from "@/lib/utils";
import { env } from "@/db/env";
import { AdminLogin } from "@/components/admin-login";
import { SignOutButton } from "@/components/sign-out-button";
import { SetupWizard } from "@/components/setup-wizard";

export const dynamic = "force-dynamic";

export default async function AdminRootPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = await getAdminPathAsync();
  // 路由不匹配 → 404 伪装（不返回 403/302，防探测）
  if (adminSlug !== adminPath) notFound();

  // 检查用户表是否为空（首次安装引导）
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const hasUsers = (row?.count ?? 0) > 0;

  // 用户表为空 → 显示引导页（创建第一个管理员）
  if (!hasUsers) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 text-center">
          <p className="font-mono text-xs text-fg-muted">首次安装引导</p>
          <h1 className="mt-2 text-xl font-semibold">初始化博客后台</h1>
          <p className="mt-2 text-sm text-fg-muted">
            创建第一个账号（自动成为管理员）。建议使用 GitHub 登录。
          </p>
        </header>
        <SetupWizard needsSecret={Boolean(env("SETUP_SECRET"))} adminPath={adminPath} />
      </main>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <AdminLogin adminPath={adminPath} />;
  if (!isAdminUser(session.user)) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 animate-page-enter">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-sm text-fg-muted">后台</p>
          <h1 className="mt-1 text-2xl font-semibold">
            你好，{session.user.name}
          </h1>
        </div>
        <SignOutButton />
      </header>
      <nav className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/${adminPath}/posts`}
          className="rounded-xl border border-border bg-surface p-6 transition hover:border-fg-faint"
        >
          <p className="text-base font-semibold">文章管理</p>
          <p className="mt-1 text-sm text-fg-muted">创建 / 编辑 / 发布 / 删除</p>
        </Link>
        <Link
          href={`/${adminPath}/media`}
          className="rounded-xl border border-border bg-surface p-6 transition hover:border-fg-faint"
        >
          <p className="text-base font-semibold">媒体库</p>
          <p className="mt-1 text-sm text-fg-muted">统一管理文章/相册图片 / 清理未使用</p>
        </Link>
        <Link
          href={`/${adminPath}/tags`}
          className="rounded-xl border border-border bg-surface p-6 transition hover:border-fg-faint"
        >
          <p className="text-base font-semibold">标签管理</p>
          <p className="mt-1 text-sm text-fg-muted">查看 / 搜索 / 删除标签 / 查看引用统计</p>
        </Link>
        <Link
          href={`/${adminPath}/friend-links`}
          className="rounded-xl border border-border bg-surface p-6 transition hover:border-fg-faint"
        >
          <p className="text-base font-semibold">友链管理</p>
          <p className="mt-1 text-sm text-fg-muted">添加 / 编辑 / 删除友情链接</p>
        </Link>
        <Link
          href={`/${adminPath}/settings`}
          className="rounded-xl border border-border bg-surface p-6 transition hover:border-fg-faint"
        >
          <p className="text-base font-semibold">站点设置</p>
          <p className="mt-1 text-sm text-fg-muted">站名 / 简介 / 社交链接 / 页脚 / 关于页面 / 存储驱动</p>
        </Link>
        <div className="rounded-xl border border-dashed border-border p-6 opacity-60">
          <p className="text-base font-semibold">更多管理</p>
          <p className="mt-1 text-sm text-fg-muted">
            定时任务 / 数据备份
          </p>
        </div>
      </nav>
    </main>
  );
}
