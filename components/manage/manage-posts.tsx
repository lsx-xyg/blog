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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AdminListPage } from "@/components/admin/list-page";
import { CreateButton, RefreshButton } from "@/components/admin/action-buttons";
import { useRouter } from "next/navigation";
import {
  FileText,
  Trash2,
  Pencil,
  CheckSquare,
  Square,
  RefreshCw,
} from "lucide-react";
import { PostStatus } from "@/lib/types/posts";
import { triggerNavigationStart } from "@/lib/shared/navigation";

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
  tags: string[]; // 标签名称数组（列表展示用）
};

interface ManagePostsProps {
  /** 后台路径，用于生成跳转 URL */
  adminPath: string;
}

export function ManagePosts({ adminPath }: ManagePostsProps) {
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

  // 危险操作确认对话框受控状态
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const remove = async (p: PostRow) => {
    setConfirmState({
      title: `删除「${p.title}」`,
      description: "关联标签将一并清理。",
      onConfirm: async () => {
        setConfirmState(null);
        const r = await fetch(`/api/admin/posts/${p.id}`, { method: "DELETE" });
        if (r.ok) {
          await load();
        } else {
          setError("删除失败");
        }
      },
    });
  };

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
    setConfirmState({
      title: `删除选中的 ${selectedIds.size} 篇文章`,
      description: "关联标签将一并清理。",
      onConfirm: async () => {
        setConfirmState(null);
        await doBatchDelete();
      },
    });
  };

  const doBatchDelete = async () => {
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
    setConfirmState({
      title: `将选中的 ${selectedIds.size} 篇文章状态修改为「${statusLabel}」`,
      danger: false,
      confirmLabel: "修改状态",
      onConfirm: async () => {
        setConfirmState(null);
        await doBatchUpdateStatus(status);
      },
    });
  };

  const doBatchUpdateStatus = async (status: PostStatus) => {
    const statusLabel = status === PostStatus.PUBLISHED ? "已发布" : status === PostStatus.SCHEDULED ? "定时" : "草稿";
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

  return (
    <>
    <AdminListPage
      title="文章管理"
      description={`全部文章（${filteredPosts.length}/${posts.length}）`}
      actions={
        <>
          <CreateButton
            onClick={() => {
              triggerNavigationStart();
              router.push(`/${adminPath}/posts/new`);
            }}
            label="新建文章"
            icon={FileText}
          />
          <RefreshButton onClick={load} loading={listLoading} />
        </>
      }
      error={error}
      search={{ value: search, onChange: setSearch, placeholder: "搜索文章..." }}
      filters={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | PostStatus)}
          className="ml-auto shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">全部状态</option>
          <option value={PostStatus.PUBLISHED}>已发布</option>
          <option value={PostStatus.DRAFT}>草稿</option>
          <option value={PostStatus.SCHEDULED}>定时</option>
        </select>
      }
      loading={listLoading}
      empty={
        filteredPosts.length === 0
          ? {
              icon: <FileText className="h-12 w-12 text-muted-foreground/50" />,
              title:
                posts.length === 0
                  ? "还没有文章"
                  : search || statusFilter !== "all"
                    ? "没有找到匹配的文章"
                    : "还没有文章",
              description:
                posts.length === 0
                  ? "点击右上角创建你的第一篇文章"
                  : search || statusFilter !== "all"
                    ? "试试调整搜索关键词或筛选条件"
                    : undefined,
            }
          : null
      }
    >
      <>
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

        {/* 桌面端：表格（与其他管理页统一样式，列天然对齐） */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-12 px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={selectedIds.size === filteredPosts.length ? "取消全选" : "全选"}
                      >
                        {selectedIds.size === filteredPosts.length && filteredPosts.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="w-24 px-4 py-3 text-center text-sm font-medium text-muted-foreground">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">标题</th>
                    <th className="w-48 px-4 py-3 text-left text-sm font-medium text-muted-foreground">标签</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Slug</th>
                    <th className="w-24 px-4 py-3 text-center text-sm font-medium text-muted-foreground">阅读</th>
                    <th className="w-28 px-4 py-3 text-right text-sm font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody key={`${statusFilter}-${search}`}>
                  {filteredPosts.map((p, i) => (
                    <tr
                      key={p.id}
                      style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                      className={`border-b border-border last:border-0 animate-fade-in-up transition-colors ${
                        selectedIds.has(p.id) ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(p.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {selectedIds.has(p.id) ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-none ${
                            p.status === PostStatus.PUBLISHED
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : p.status === PostStatus.SCHEDULED
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.status === PostStatus.PUBLISHED
                            ? "已发布"
                            : p.status === PostStatus.SCHEDULED
                              ? "定时"
                              : "草稿"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block max-w-[280px] truncate">{p.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        {Array.isArray(p.tags) && p.tags.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {p.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                              >
                                {t}
                              </span>
                            ))}
                            {p.tags.length > 3 && (
                              <span className="text-[11px] text-fg-faint">
                                +{p.tags.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-fg-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-fg-faint">
                        /posts/{p.slug ?? p.id}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-fg-faint">
                        {p.viewCount} 阅
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              triggerNavigationStart();
                              router.push(`/${adminPath}/posts/${p.id}/edit`);
                            }}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(p)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端：紧凑行列表（Slug 与独立标签列隐藏，标签附在标题下方） */}
            <div className="md:hidden overflow-hidden rounded-xl border border-border bg-card">
              <ul
                key={`${statusFilter}-${search}`}
                className="divide-y divide-border"
              >
                {filteredPosts.map((p, i) => (
                  <li
                    key={p.id}
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                    className={`animate-fade-in-up px-4 py-3 transition-colors ${
                      selectedIds.has(p.id) ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    {/* 数据区 */}
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(p.id)}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selectedIds.has(p.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${
                              p.status === PostStatus.PUBLISHED
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : p.status === PostStatus.SCHEDULED
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {p.status === PostStatus.PUBLISHED
                              ? "已发布"
                              : p.status === PostStatus.SCHEDULED
                                ? "定时"
                                : "草稿"}
                          </span>
                          <p className="truncate text-base">{p.title}</p>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-fg-faint">
                          /posts/{p.slug ?? p.id} · {p.viewCount} 阅
                        </p>
                        {Array.isArray(p.tags) && p.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {p.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                              >
                                {t}
                              </span>
                            ))}
                            {p.tags.length > 3 && (
                              <span className="text-[11px] text-fg-faint">
                                +{p.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 操作区：放数据下方 */}
                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerNavigationStart();
                          router.push(`/${adminPath}/posts/${p.id}/edit`);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="编辑"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
      </>
    </AdminListPage>

      {/* 危险操作确认 */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        danger={confirmState?.danger}
        onConfirm={confirmState?.onConfirm ?? (() => {})}
        onClose={() => setConfirmState(null)}
      />
    </>
  );
}
