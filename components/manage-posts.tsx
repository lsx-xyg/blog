"use client";

/**
 * 后台文章管理（列表页）
 *
 * 功能：
 * - 文章列表展示
 * - 搜索、状态筛选
 * - 批量选择、批量操作（删除、修改状态）
 * - 刷新列表
 * - 点击"新建文章"跳转到新建页面
 * - 点击"编辑"跳转到编辑页面
 *
 * 设计说明：
 * - 这个组件只负责文章列表，不包含编辑器
 * - 编辑器在独立的 PostEditor 组件中，通过路由跳转
 * - 这样可以减少列表页的首屏体积，提升加载速度
 * - 移动端搜索、状态筛选、刷新按钮放在同一行，节省空间
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw,
  Eye,
  Calendar,
  Pencil,
} from "lucide-react";
import { PostStatus } from "@/lib/types/posts";

type PostRow = {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  content: string;
  status: PostStatus;
  featured: boolean;
  coverUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
};

export function ManagePosts() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [error, setError] = useState("");

  // 文章列表增强：搜索、筛选、批量操作
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PostStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  // 文章列表加载状态（用于刷新按钮和初始加载）
  const [listLoading, setListLoading] = useState(true);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const r = await fetch("/api/admin/posts");
      if (r.ok) {
        const d = await r.json();
        setPosts(d.posts);
      } else {
        setError("加载文章列表失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文章列表失败");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 过滤后的文章列表（搜索 + 状态筛选）
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      // 状态筛选
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      // 搜索（标题、slug、摘要）
      if (search) {
        const keyword = search.toLowerCase();
        return (
          p.title.toLowerCase().includes(keyword) ||
          (p.slug?.toLowerCase().includes(keyword) ?? false) ||
          (p.summary?.toLowerCase().includes(keyword) ?? false)
        );
      }
      return true;
    });
  }, [posts, search, statusFilter]);

  // 切换选中状态
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPosts.map((p) => p.id)));
    }
  };

  // 批量删除
  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 篇文章？关联标签将一并清理。`)) return;

    setBatchLoading(true);
    setError("");
    try {
      // 逐个删除（后端没有批量删除接口）
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/admin/posts/${id}`, { method: "DELETE" }),
      );
      const results = await Promise.all(promises);
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setError(`部分删除失败：${failed} 篇`);
      }
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量删除失败");
    } finally {
      setBatchLoading(false);
    }
  };

  // 批量修改状态
  const batchUpdateStatus = async (status: PostStatus) => {
    if (selectedIds.size === 0) return;
    const statusLabel = status === PostStatus.PUBLISHED ? "已发布" : status === PostStatus.SCHEDULED ? "定时" : "草稿";
    if (!confirm(`确定将选中的 ${selectedIds.size} 篇文章状态修改为「${statusLabel}」？`)) return;

    setBatchLoading(true);
    setError("");
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/admin/posts/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      );
      const results = await Promise.all(promises);
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setError(`部分修改失败：${failed} 篇`);
      }
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量修改失败");
    } finally {
      setBatchLoading(false);
    }
  };

  const remove = async (p: PostRow) => {
    if (!confirm(`确定删除「${p.title}」？关联标签将一并清理。`)) return;
    const r = await fetch(`/api/admin/posts/${p.id}`, { method: "DELETE" });
    if (r.ok) {
      await load();
    } else {
      setError("删除失败");
    }
  };

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case PostStatus.PUBLISHED:
        return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">已发布</span>;
      case PostStatus.DRAFT:
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">草稿</span>;
      case PostStatus.SCHEDULED:
        return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">定时</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="animate-page-enter">
      <header className="mb-6">
        <h1 className="text-xl font-semibold md:text-2xl">文章管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          创建、编辑、发布和管理你的博客文章
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <section>
        {/* 标题和搜索筛选 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-fg-muted">
            全部文章（{filteredPosts.length}/{posts.length}）
          </h2>
          {/* 移动端：搜索、筛选、刷新按钮放在同一行，不换行 */}
          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
            {/* 新建文章按钮 */}
            <button
              type="button"
              onClick={() => router.push(`/dashboard/posts/new`)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">新建文章</span>
            </button>
            {/* 搜索框 */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索..."
                className="w-28 rounded-lg border border-input bg-background py-1.5 pl-9 pr-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-40 md:w-48"
              />
            </div>
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | PostStatus)}
              className="shrink-0 rounded-lg border border-input bg-background py-1.5 px-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">全部</option>
              <option value={PostStatus.PUBLISHED}>已发布</option>
              <option value={PostStatus.DRAFT}>草稿</option>
              <option value={PostStatus.SCHEDULED}>定时</option>
            </select>
            {/* 刷新按钮 */}
            <button
              type="button"
              onClick={load}
              disabled={listLoading}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="刷新列表"
            >
              <RefreshCw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 批量操作工具栏（当有选中文章时显示） */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-fade-in-up">
            <span className="text-sm font-medium text-primary">
              已选中 {selectedIds.size} 篇文章
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* 批量修改状态 */}
              <button
                type="button"
                onClick={() => batchUpdateStatus(PostStatus.PUBLISHED)}
                disabled={batchLoading}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                设为已发布
              </button>
              <button
                type="button"
                onClick={() => batchUpdateStatus(PostStatus.DRAFT)}
                disabled={batchLoading}
                className="flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors disabled:opacity-50"
              >
                设为草稿
              </button>
              {/* 批量删除 */}
              <button
                type="button"
                onClick={batchDelete}
                disabled={batchLoading}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                批量删除
              </button>
              {/* 取消选择 */}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={batchLoading}
                className="rounded-lg border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors disabled:opacity-50"
              >
                取消选择
              </button>
            </div>
          </div>
        )}

        {/* 文章列表加载中：显示骨架屏 */}
        {listLoading ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {/* 表头骨架 */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
            {/* 列表骨架（5 行） */}
            <ul className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                  <div className="hidden h-4 w-24 animate-pulse rounded bg-muted sm:block" />
                  <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-20 shrink-0 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              {posts.length === 0
                ? "还没有文章，点击上方创建你的第一篇文章"
                : search || statusFilter !== "all"
                ? "没有找到匹配的文章，试试调整搜索关键词或筛选条件"
                : "还没有文章"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {/* 表头：全选复选框 */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title={selectedIds.size === filteredPosts.length ? "取消全选" : "全选"}
              >
                {selectedIds.size === filteredPosts.length && filteredPosts.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span className="w-16 shrink-0 text-center text-xs font-medium text-muted-foreground">状态</span>
              <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">标题</span>
              <span className="hidden font-mono text-xs text-muted-foreground sm:block">Slug</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">阅读</span>
              <span className="shrink-0 text-right text-xs font-medium text-muted-foreground w-20">操作</span>
            </div>
            {/* 文章列表 */}
            <ul className="divide-y divide-border">
              {filteredPosts.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 text-base transition-colors ${
                    selectedIds.has(p.id) ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  {/* 复选框 */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(p.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {selectedIds.has(p.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  {/* 状态 */}
                  <div className="w-16 shrink-0">
                    {getStatusBadge(p.status)}
                  </div>
                  {/* 标题 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.title}</span>
                      {p.featured && (
                        <span className="shrink-0 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800">精选</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                      {p.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          发布于 {new Date(p.publishedAt).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Slug */}
                  <span className="hidden truncate font-mono text-xs text-muted-foreground sm:block w-24">
                    {p.slug || p.id.slice(0, 8)}
                  </span>
                  {/* 阅读量 */}
                  <span className="shrink-0 font-mono text-xs text-muted-foreground w-12 text-right">
                    {p.viewCount}
                  </span>
                  {/* 操作按钮 */}
                  <div className="flex shrink-0 items-center gap-1 w-20 justify-end">
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/posts/${p.id}/edit`)}
                      className="flex items-center gap-1 rounded-lg border border-input px-2 py-1 text-xs hover:bg-accent transition-colors"
                      title="编辑"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">编辑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
