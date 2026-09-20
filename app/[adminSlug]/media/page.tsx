/** 后台媒体库管理：动态路径（/[adminSlug]/media），未匹配/未授权一律 404 伪装 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server/auth";
import { getAdminPathAsync } from "@/lib/shared/admin-path";
import { isAdminUser } from "@/lib/shared/utils";
import { ManageMedia } from "@/components/manage/manage-media";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage({
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
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 animate-page-enter">
      <AdminBreadcrumb current="媒体库" adminPath={adminPath} />
      <ManageMedia />
    </div>
  );
}
