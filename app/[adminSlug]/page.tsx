/** 后台根路径：路由不匹配一律 404 伪装；用户表为空 → 引导页；未登录 → 登录页；非管理员 → 404 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { sql, desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, posts, tags, media, friendLinks } from "@/db/schema";
import { PostStatus } from "@/lib/types/posts";
import { auth } from "@/lib/auth/auth";
import { getAdminPathAsync } from "@/lib/shared/admin-path";
import { isAdminUser } from "@/lib/shared/utils";
import { formatDate } from "@/lib/shared/utils";
import { getEnv } from "@/lib/env/utils";
import { AdminLogin } from "@/components/admin-login";
import { SignOutButton } from "@/components/sign-out-button";
import { SetupWizard } from "@/components/setup-wizard";
import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import DashboardCards from "@/components/admin/dashboard-cards";
import QuickLinks from "@/components/admin/quick-links";
import { getSetting } from "@/lib/settings/store";
import {
  normalizeCardOrder,
  normalizeQuickOrder,
  DASHBOARD_ORDER_KEY,
  QUICK_ORDER_KEY,
} from "@/lib/admin/dashboard-order";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Image as ImageIcon,
  Calendar,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminRootPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const adminPath = await getAdminPathAsync();
  // 路由不匹配 → 404 伪装（不返回 403/302，防探测）
  if (adminSlug !== adminPath) notFound();

  // 检查用户表是否为空（首次安装引导）
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const hasUsers = (row?.count ?? 0) > 0;

  // 用户表为空 → 显示引导页（创建第一个管理员）
  if (!hasUsers) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pt-16 pb-12 md:pt-24">
        <header className="mb-8 text-center">
          <p className="font-mono text-xs text-fg-muted">首次安装引导</p>
          <h1 className="mt-2 text-xl font-semibold">初始化博客后台</h1>
          <p className="mt-2 text-sm text-fg-muted">
            创建第一个账号（自动成为管理员）。建议使用 GitHub 登录。
          </p>
        </header>
        <SetupWizard needsSecret={Boolean(getEnv("SETUP_SECRET"))} adminPath={adminPath} />
      </main>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <AdminLogin adminPath={adminPath} />;
  if (!isAdminUser(session.user)) notFound();

  // 查询统计数据
  const [
    totalPosts,
    publishedPosts,
    draftPosts,
    scheduledPosts,
    totalTags,
    totalMedia,
    totalFriendLinks,
    totalViews,
    recentPosts,
    recentMedia,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(posts),
    db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.status, PostStatus.PUBLISHED)),
    db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.status, PostStatus.DRAFT)),
    db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.status, PostStatus.SCHEDULED)),
    db.select({ count: sql<number>`count(*)::int` }).from(tags),
    db.select({ count: sql<number>`count(*)::int` }).from(media),
    db.select({ count: sql<number>`count(*)::int` }).from(friendLinks),
    db.select({ sum: sql<number>`coalesce(sum(view_count), 0)::int` }).from(posts),
    db.select({ id: posts.id, title: posts.title, status: posts.status, createdAt: posts.createdAt, slug: posts.slug })
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(5),
    db.select({ id: media.id, url: media.url, title: media.title, createdAt: media.createdAt, type: media.type })
      .from(media)
      .orderBy(desc(media.createdAt))
      .limit(5),
  ]);

  const stats = {
    totalPosts: totalPosts[0]?.count ?? 0,
    publishedPosts: publishedPosts[0]?.count ?? 0,
    draftPosts: draftPosts[0]?.count ?? 0,
    scheduledPosts: scheduledPosts[0]?.count ?? 0,
    totalTags: totalTags[0]?.count ?? 0,
    totalMedia: totalMedia[0]?.count ?? 0,
    totalFriendLinks: totalFriendLinks[0]?.count ?? 0,
    totalViews: totalViews[0]?.sum ?? 0,
  };

  // 读取用户自定义排序（未自定义返回 null → 前端使用默认顺序）
  const savedCardOrder = await getSetting<string[]>(DASHBOARD_ORDER_KEY);
  const cardOrder = savedCardOrder ? normalizeCardOrder(savedCardOrder) : null;
  const savedQuickOrder = await getSetting<string[]>(QUICK_ORDER_KEY);
  const quickOrder = savedQuickOrder ? normalizeQuickOrder(savedQuickOrder) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 animate-page-enter">
      {/* 面包屑导航：后台首页不显示当前页面，避免重复 */}
      <AdminBreadcrumb adminPath={adminPath} />

      {/* 欢迎信息 + 退出按钮 */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            你好，{session.user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">欢迎回来，这是你的博客数据概览</p>
        </div>
        <SignOutButton />
      </header>

      {/* 统计卡片行：可拖拽排序（拖把手），顺序跨设备保存，默认顺序兜底 */}
      <div className="mb-6">
        <DashboardCards stats={stats} initialOrder={cardOrder} />
      </div>

      {/* 最近活动区域 */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* 最近发布的文章 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                最近文章
              </CardTitle>
              <Link href={`/${adminPath}/posts`} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                查看全部
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无文章，点击「写文章」开始创作</p>
            ) : (
              <div className="space-y-2">
                {recentPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/${adminPath}/posts?id=${post.id}`}
                    className="flex items-center justify-between rounded-lg p-2 hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{post.title || "无标题"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(post.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        post.status === PostStatus.PUBLISHED
                          ? "default"
                          : post.status === PostStatus.SCHEDULED
                          ? "secondary"
                          : "outline"
                      }
                      className="ml-2 shrink-0 text-xs"
                    >
                      {post.status === PostStatus.PUBLISHED
                        ? "已发布"
                        : post.status === PostStatus.SCHEDULED
                        ? "定时"
                        : "草稿"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近上传的媒体 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                最近媒体
              </CardTitle>
              <Link href={`/${adminPath}/media`} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                查看全部
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentMedia.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无媒体，上传你的第一张图片吧</p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {recentMedia.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${adminPath}/media?id=${item.id}`}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                    title={item.title || "图片"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.title || "图片"}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      loading="lazy"
                    />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快捷入口：可拖拽排序（拖把手），顺序跨设备保存，默认顺序兜底 */}
      <div className="mb-6">
        <QuickLinks adminPath={adminPath} initialOrder={quickOrder} />
      </div>
    </main>
  );
}
