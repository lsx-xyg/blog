/** 后台文章管理：动态路径（/[adminSlug]/posts），未匹配/未授权一律 404 伪装 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAdminPathAsync } from "@/lib/admin-path";
import { isAdminUser } from "@/lib/utils";
import { ManagePosts } from "@/components/manage-posts";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = await getAdminPathAsync();
  if (adminSlug !== adminPath) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) notFound();

  return <ManagePosts />;
}
