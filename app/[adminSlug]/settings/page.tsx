/** 后台站点设置：动态路径，未匹配/未授权一律 404 伪装 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAdminPath } from "@/lib/admin-path";
import { isAdminUser } from "@/lib/utils";
import { ManageSettings } from "@/components/manage-settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  if (adminSlug !== getAdminPath()) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) notFound();

  return <ManageSettings />;
}
