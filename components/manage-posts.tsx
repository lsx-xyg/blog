"use client";

import { useCallback, useEffect, useState } from "react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { ChevronLeft, ChevronRight, FileText, Settings } from "lucide-react";

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
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
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
  status: "DRAFT" as PostRow["status"],
  featured: false,
  scheduledAt: "",
};

const STEPS = [
  { id: 1, label: "正文编辑", icon: FileText },
  { id: 2, label: "基本信息", icon: Settings },
];

export function ManagePosts() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/posts");
    if (r.ok) {
      const d = await r.json();
      setPosts(d.posts);
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
      // 编辑时内容留空 → 不传 content，服务端保持原值
      const payload: Record<string, unknown> = {
        ...form,
        scheduledAt: form.scheduledAt || null,
      };
      if (editingId && !form.content) delete payload.content;
      if (editingId) {
        const r = await fetch(`/api/admin/posts/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("保存失败");
      } else {
        const r = await fetch("/api/admin/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("创建失败");
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

  const input =
    "rounded-lg border border-border bg-surface-strong px-3 py-2 text-sm outline-none focus:border-ring";
  const label = "text-xs font-medium text-fg-muted";

  const goToStep = (step: number) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="font-mono text-xs text-fg-muted">
          manage · 开发期入口（T8 认证后收紧）
        </p>
        <h1 className="mt-2 text-xl font-semibold">文章管理</h1>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <form
        onSubmit={save}
        className="mb-10 rounded-xl border border-border bg-surface p-6"
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
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
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

        {/* 步骤 1：正文编辑 */}
        {currentStep === 1 && (
          <div className="space-y-4">
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
          <div className="space-y-4">
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
                  <option value="DRAFT">草稿</option>
                  <option value="SCHEDULED">定时</option>
                  <option value="PUBLISHED">发布</option>
                </select>
              </div>
              <div>
                <label className={label}>定时发布（可选，需 T12 扫描任务生效）</label>
                <input
                  type="datetime-local"
                  className={`${input} mt-1 w-full font-mono`}
                  value={form.scheduledAt}
                  onChange={(e) => set("scheduledAt", e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
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

        {/* 底部按钮 */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => goToStep(currentStep - 1)}
                className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                上一步
              </button>
            )}
            {currentStep < STEPS.length && (
              <button
                type="button"
                onClick={() => goToStep(currentStep + 1)}
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                下一步
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                取消
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {loading ? "保存中…" : editingId ? "保存修改" : "创建文章"}
            </button>
          </div>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-fg-muted">
          全部文章（{posts.length}）
        </h2>
        {posts.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-fg-muted">
            还没有文章
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {posts.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span
                  className={`w-16 shrink-0 text-center font-mono text-xs ${
                    p.status === "PUBLISHED"
                      ? "text-green-600"
                      : p.status === "SCHEDULED"
                        ? "text-amber-600"
                        : "text-fg-faint"
                  }`}
                >
                  {p.status === "PUBLISHED"
                    ? "已发布"
                    : p.status === "SCHEDULED"
                      ? "定时"
                      : "草稿"}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="hidden font-mono text-xs text-fg-faint sm:block">
                  /posts/{p.slug ?? p.id}
                </span>
                <span className="shrink-0 font-mono text-xs text-fg-faint">
                  {p.viewCount} 阅
                </span>
                <button
                  onClick={() => startEdit(p)}
                  className="shrink-0 text-primary hover:underline"
                >
                  编辑
                </button>
                <button
                  onClick={() => remove(p)}
                  className="shrink-0 text-red-500 hover:underline"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
