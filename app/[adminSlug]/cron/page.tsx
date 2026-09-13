/** 后台定时任务管理：动态路径，未匹配/未授权一律 404 伪装 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAdminPathAsync } from "@/lib/admin-path";
import { isAdminUser } from "@/lib/utils";
import { ManageCron } from "@/components/manage-cron";

export const dynamic = "force-dynamic";

export default async function AdminCronPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = await getAdminPathAsync();
  if (adminSlug !== adminPath) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) notFound();

  return <ManageCron />;
}
