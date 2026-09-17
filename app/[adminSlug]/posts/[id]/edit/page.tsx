/**
 * 编辑文章页面（独立路由）
 *
 * 路由：/[adminSlug]/posts/[id]/edit
 *
 * 功能：
 * - 使用独立的 PostEditor 组件
 * - 根据文章 ID 获取文章数据，作为初始值传入编辑器
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
import { getPostById } from "@/lib/posts";
import { PostEditor } from "@/components/post-editor";
import type { PostFormData } from "@/lib/posts/form";
import { AdminBreadcrumb } from "@/components/admin-breadcrumb";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ adminSlug: string; id: string }>;
}) {
  const { adminSlug, id } = await params;
  const adminPath = await getAdminPathAsync();
  if (adminSlug !== adminPath) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) notFound();

  // 获取文章数据
  const post = await getPostById(id);
  if (!post) notFound();

  // 转换为编辑器需要的格式
  const initialData: PostFormData = {
    title: post.title,
    slug: post.slug ?? "",
    summary: post.summary ?? "",
    content: post.content ?? "",
    coverUrl: post.coverUrl ?? "",
    status: post.status,
    featured: post.featured,
    scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString().slice(0, 16) : "",
    tags: post.tags ?? [],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 animate-page-enter">
      <AdminBreadcrumb
        current="编辑文章"
        adminPath={adminPath}
        parent={{ label: "文章管理", href: `/${adminPath}/posts` }}
      />
      <PostEditor postId={id} initialData={initialData} adminPath={adminPath} />
    </div>
  );
}
