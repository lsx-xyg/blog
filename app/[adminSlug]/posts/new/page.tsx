/**
 * 新建文章页面（独立路由）
 *
 * 路由：/[adminSlug]/posts/new
 *
 * 功能：
 * - 使用独立的 PostEditor 组件
 * - 不包含文章列表，首屏体积更小
 * - 保存后返回文章列表页
 *
 * 设计说明：
 * - 把编辑器从文章列表页抽离出来，做成独立页面
 * - 这样文章列表页首屏不包含编辑器代码，加载速度更快
 * - 编辑器页面有独立的 URL，可以分享、刷新等
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getAdminPathAsync } from "@/lib/shared/admin-path";
import { isAdminUser } from "@/lib/shared/utils";
import { PostEditor } from "@/components/posts/post-editor";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";

export const dynamic = "force-dynamic";

export default async function NewPostPage({
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
      <AdminBreadcrumb
        current="新建文章"
        adminPath={adminPath}
        parent={{ label: "文章管理", href: `/${adminPath}/posts` }}
      />
      <PostEditor postId={null} adminPath={adminPath} />
    </div>
  );
}
