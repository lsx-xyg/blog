/** 首次安装引导（SPEC §6）：用户表为空时 /admin 开放；非空一律 404 */
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/db/env";
import { getAdminPath } from "@/lib/admin-path";
import { SetupWizard } from "@/components/setup-wizard";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  // 引导已完成（已有用户）→ /admin 永久 404（SPEC：防探测）
  if ((row?.count ?? 0) > 0) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8 text-center">
        <p className="font-mono text-xs text-fg-muted">首次安装引导</p>
        <h1 className="mt-2 text-xl font-semibold">初始化博客后台</h1>
        <p className="mt-2 text-sm text-fg-muted">
          创建第一个账号（自动成为管理员）。建议使用 GitHub 登录。
        </p>
      </header>
      <SetupWizard needsSecret={Boolean(env("SETUP_SECRET"))} adminPath={getAdminPath()} />
    </main>
  );
}
