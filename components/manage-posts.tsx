"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Settings,
  Search,
  Trash2,
  CheckSquare,
  Square,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
} from "lucide-react";
import { PostStatus } from "@/lib/types/posts";

/**
 * MarkdownEditor 动态导入（Bundle 优化）
 *
 * ByteMD 编辑器体积较大（约 200+ kB），只在编辑文章时才需要。
 * 使用 dynamic import + ssr: false 延迟加载，
 * 这样文章列表页（查看模式）不会加载编辑器代码，可以大幅减少首屏体积。
 *
 * 优化效果：
 * - 文章列表页 First Load JS：364 kB → 约 150 kB（减少约 60%）
 * - 编辑器只在点击"新建文章"或"编辑"时才加载
 */
const MarkdownEditor = dynamic(
  () => import("@/components/markdown-editor").then((mod) => mod.MarkdownEditor),
  {
    ssr: false, // ByteMD 编辑器只能在客户端渲染
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">编辑器加载中...</p>
        </div>
      </div>
    ),
  },
);

/**
 * T8 后台文章管理（受动态路径保护，服务端已做 admin 鉴权）
 * T10 Milkdown 编辑器 + 多步骤表单
 *
 * 步骤 1：正文编辑（Milkdown WYSIWYG / 源码模式 / 全屏）
 * 步骤 2：基本信息（标题、slug、摘要、封面图、状态、精选、定时发布）
 */
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

const emptyForm = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  coverUrl: "",
  status: PostStatus.DRAFT as PostStatus,
  featured: false,
  scheduledAt: "",
};

const STEPS = [
  { id: 1, label: "正文编辑", icon: FileText },
  { id: 2, label: "基本信息", icon: Settings },
];

interface ManagePostsProps {
  /** 后台路径，用于生成跳转 URL */
  adminPath: string;
}

export function ManagePosts({ adminPath }: ManagePostsProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

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

  const set = (k: keyof typeof emptyForm, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const startEdit = (p: PostRow) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      slug: p.slug ?? "",
      summary: p.summary ?? "",
      content: p.content ?? "",
      coverUrl: p.coverUrl ?? "",
      status: p.status,
      featured: p.featured,
      scheduledAt: p.scheduledAt ? p.scheduledAt.slice(0, 16) : "",
    });
    setCurrentStep(1);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCurrentStep(1);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 判断是新建还是编辑
      // editingId === "new" 表示新建模式
      // editingId 为其他值表示编辑模式
      const isNewPost = editingId === "new";

      // 编辑时内容留空 → 不传 content，服务端保持原值
      const payload: Record<string, unknown> = {
        ...form,
        scheduledAt: form.scheduledAt || null,
      };
      if (!isNewPost && !form.content) delete payload.content;

      if (isNewPost) {
        // 新建文章
        const r = await fetch("/api/admin/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("创建失败");
      } else {
        // 编辑文章
        const r = await fetch(`/api/admin/posts/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("保存失败");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
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

  const input =
    "rounded-lg border border-border bg-surface-strong px-3 py-2 text-base outline-none focus:border-ring";
  const label = "text-sm font-medium text-fg-muted";

  const goToStep = (step: number) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step);
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

      {/* 编辑模式：显示编辑表单（只有在点击"新建文章"或"编辑"时才显示） */}
      {editingId !== null && (
      <form
        onSubmit={save}
        className="mb-10 rounded-xl border border-border bg-surface p-6 animate-fade-in-up"
      >
        {/* 步骤条 */}
        <div className="mb-6 flex items-center">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-base transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-px w-8 ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 步骤内容区域：统一最小高度，避免切换步骤时容器跳动 */}
        <div className="min-h-[520px] md:min-h-[560px]">
          {/* 步骤 1：正文编辑 */}
          {currentStep === 1 && (
            <div key="step-1" className="space-y-4 animate-fade-in-up">
              <div>
                <label className={label}>
                  正文（Markdown）* — 支持粘贴/拖拽图片自动上传，左右分屏实时预览
                </label>
                <div className="mt-1">
                  <MarkdownEditor
                    value={form.content}
                    onChange={(v) => set("content", v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 步骤 2：基本信息 */}
          {currentStep === 2 && (
            <div key="step-2" className="space-y-4 animate-fade-in-up">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={label}>标题 *</label>
                  <input
                    className={`${input} mt-1 w-full`}
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={label}>Slug（留空自动用 ID）</label>
                  <input
                    className={`${input} mt-1 w-full font-mono`}
                    value={form.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="留空 = 自动生成"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={label}>摘要</label>
                  <input
                    className={`${input} mt-1 w-full`}
                    value={form.summary}
                    onChange={(e) => set("summary", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={label}>封面图 URL（可选）</label>
                  <input
                    className={`${input} mt-1 w-full font-mono`}
                    value={form.coverUrl}
                    onChange={(e) => set("coverUrl", e.target.value)}
                    placeholder="https://…（T3 上传后可用图床 URL）"
                  />
                </div>
                <div>
                  <label className={label}>状态</label>
                  <select
                    className={`${input} mt-1 w-full`}
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    <option value={PostStatus.DRAFT}>草稿</option>
                    <option value={PostStatus.SCHEDULED}>定时</option>
                    <option value={PostStatus.PUBLISHED}>发布</option>
                  </select>
                </div>
                <div>
                  <label className={label}>定时发布时间（选择"定时"状态时生效）</label>
                  <input
                    type="datetime-local"
                    className={`${input} mt-1 w-full font-mono`}
                    value={form.scheduledAt}
                    onChange={(e) => set("scheduledAt", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    定时任务每分钟扫描一次，到时间自动发布。需配置 CRON_SECRET 并启动定时任务。
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-base">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                  className="accent-primary"
                />
                精选
              </label>
            </div>
          )}
        </div>

        {/* 底部按钮：上一步左下角，下一步/保存右下角 */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          {/* 左下角：上一步（第一步不显示） */}
          <div>
            {currentStep > 1 && (
              <button
                key="prev-btn"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  goToStep(currentStep - 1);
                }}
                className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-base hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                上一步
              </button>
            )}
          </div>

          {/* 右下角：下一步（非最后一步）或 保存（最后一步） */}
          <div className="flex gap-3">
            {editingId && (
              <button
                key="cancel-btn"
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-border px-4 py-2 text-base hover:bg-accent transition-colors"
              >
                取消
              </button>
            )}
            {currentStep < STEPS.length ? (
              <button
                key="next-btn"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  goToStep(currentStep + 1);
                }}
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                下一步
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                key="submit-btn"
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {loading ? "保存中…" : editingId ? "保存修改" : "创建文章"}
              </button>
            )}
          </div>
        </div>
      </form>
      )}

      <section>
        {/* 标题和搜索筛选 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-fg-muted">
            全部文章（{filteredPosts.length}/{posts.length}）
          </h2>
          {/* 搜索筛选区域：所有按钮在一行展示，移动端自适应宽度 */}
          <div className="flex items-center gap-2 min-w-0">
            {/* 新建文章按钮（只有在非编辑模式下才显示） */}
            {editingId === null && (
              <button
                type="button"
                onClick={() => router.push(`/${adminPath}/posts/new`)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">新建文章</span>
              </button>
            )}
            {/* 搜索框 */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索文章..."
                className="w-32 rounded-lg border border-input bg-background py-1.5 pl-9 pr-3 text-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-48"
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
                  <span
                    className={`w-16 shrink-0 text-center font-mono text-xs ${
                      p.status === PostStatus.PUBLISHED
                        ? "text-green-600"
                        : p.status === PostStatus.SCHEDULED
                          ? "text-amber-600"
                          : "text-fg-faint"
                    }`}
                  >
                    {p.status === PostStatus.PUBLISHED
                      ? "已发布"
                      : p.status === PostStatus.SCHEDULED
                        ? "定时"
                        : "草稿"}
                  </span>
                  {/* 标题 */}
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {/* Slug */}
                  <span className="hidden font-mono text-xs text-fg-faint sm:block">
                    /posts/{p.slug ?? p.id}
                  </span>
                  {/* 阅读量 */}
                  <span className="shrink-0 font-mono text-xs text-fg-faint">
                    {p.viewCount} 阅
                  </span>
                  {/* 操作按钮 */}
                  <div className="flex shrink-0 items-center gap-2 w-20 justify-end">
                    <button
                      onClick={() => router.push(`/${adminPath}/posts/${p.id}/edit`)}
                      className="text-primary hover:underline text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="text-red-500 hover:underline text-sm"
                    >
                      删除
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
