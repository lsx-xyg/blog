/** 后台根路径：路由不匹配一律 404 伪装；未登录 → 登录页；非管理员 → 404 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAdminPath } from "@/lib/admin-path";
import { isAdminUser } from "@/lib/utils";
import { AdminLogin } from "@/components/admin-login";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function AdminRootPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = getAdminPath();
  // 路由不匹配 → 404 伪装（不返回 403/302，防探测）
  if (adminSlug !== adminPath) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <AdminLogin adminPath={adminPath} />;
  if (!isAdminUser(session.user)) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-sm text-fg-muted">后台</p>
          <h1 className="mt-1 text-2xl font-semibold">
            你好，{session.user.name}
          </h1>
        </div>
        <SignOutButton />
      </header>
      <nav className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`/${adminPath}/posts`}
          className="rounded-xl border border-border bg-surface p-6 transition hover:border-fg-faint"
        >
          <p className="text-base font-semibold">文章管理</p>
          <p className="mt-1 text-sm text-fg-muted">创建 / 编辑 / 发布 / 删除</p>
        </Link>
        <div className="rounded-xl border border-dashed border-border p-6 opacity-60">
          <p className="text-base font-semibold">更多管理（T10）</p>
          <p className="mt-1 text-sm text-fg-muted">
            相册 / 标签 / 友链 / 设置 / 备份
          </p>
        </div>
      </nav>
    </main>
  );
}
