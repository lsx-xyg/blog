/** 后台引导管理：动态路径（/[adminSlug]/guides），未匹配/未授权一律 404 伪装 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getAdminPathAsync } from "@/lib/shared/admin-path";
import { isAdminUser } from "@/lib/shared/utils";
import { ManageGuides } from "@/components/manage-guides";
import { AdminBreadcrumb } from "@/components/admin-breadcrumb";

export const dynamic = "force-dynamic";

export default async function AdminGuidesPage({
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
      <AdminBreadcrumb current="引导管理" adminPath={adminPath} />
      <ManageGuides adminPath={adminPath} />
    </div>
  );
}
