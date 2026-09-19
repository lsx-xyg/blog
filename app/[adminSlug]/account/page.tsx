/** 后台账号设置：修改密码 / 关联 GitHub；未匹配/未授权一律 404 伪装 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getAdminPathAsync } from "@/lib/shared/admin-path";
import { isAdminUser } from "@/lib/shared/utils";
import { AccountSettings } from "@/components/auth/account-settings";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = await getAdminPathAsync();
  if (adminSlug !== adminPath) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 animate-page-enter">
      <AdminBreadcrumb current="账号设置" adminPath={adminPath} />
      <h1 className="mb-6 text-xl font-semibold">账号设置</h1>
      <AccountSettings />
    </div>
  );
}
