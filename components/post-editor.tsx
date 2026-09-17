"use client";

/**
 * 文章编辑器组件（独立页面使用）——C10 精简后只做 JSX 装配
 *
 * 功能：
 * - 多步骤表单（步骤1：正文编辑，步骤2：基本信息）
 * - Markdown 编辑器（ByteMD，动态加载）
 * - 新建/编辑文章
 * - 保存后返回文章列表页
 *
 * 表单状态机 / 保存编排在 components/post/use-post-form.ts，
 * 数据模型 / payload / 校验在 lib/posts/form.ts（纯函数）。
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, FileText, ImagePlus, Settings, X } from "lucide-react";
import { TagInput } from "@/components/tag-input";
import { MediaPicker } from "@/components/media-picker";
import { usePostForm } from "@/components/post/use-post-form";
import { EDITOR_STEPS, type PostFormData } from "@/lib/posts/form";
import { PostStatus } from "@/lib/types/posts";

/**
 * MarkdownEditor 动态导入（Bundle 优化）
 *
 * ByteMD 编辑器体积较大（约 200+ kB），只在编辑文章时才需要。
 * 使用 dynamic import + ssr: false 延迟加载。
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

interface PostEditorProps {
  /** 文章 ID（编辑时传入，新建时为 null） */
  postId: string | null;
  /** 初始数据（编辑时传入，新建时为空） */
  initialData?: PostFormData;
  /** 后台路径，用于返回列表页 */
  adminPath: string;
}

export function PostEditor({ postId, initialData, adminPath }: PostEditorProps) {
  const { form, setForm, set, currentStep, goToStep, save, goToList, loading, error, allTags } =
    usePostForm({ postId, initialData, adminPath });
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const input =
    "rounded-lg border border-border bg-surface-strong px-3 py-2 text-base outline-none focus:border-ring";
  const label = "text-sm font-medium text-fg-muted";

  return (
    <div className="animate-page-enter">
      <header className="mb-6">
        <h1 className="text-xl font-semibold md:text-2xl">
          {postId ? "编辑文章" : "新建文章"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {postId ? "修改文章内容和基本信息" : "创建一篇新的博客文章"}
        </p>
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
          {EDITOR_STEPS.map((step, index) => {
            const Icon = step.id === 1 ? FileText : Settings;
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
                {index < EDITOR_STEPS.length - 1 && (
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
                  <label className={label}>封面图（可选）</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      className={`${input} w-full font-mono`}
                      value={form.coverUrl}
                      onChange={(e) => set("coverUrl", e.target.value)}
                      placeholder="https://… 或点击右侧从图库选择 / 上传"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCoverPicker(true)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-strong px-3 py-2 text-sm text-fg-muted transition-colors hover:text-foreground"
                      title="从图库选择或上传图片"
                    >
                      <ImagePlus className="h-4 w-4" />
                      图库/上传
                    </button>
                  </div>
                  {form.coverUrl ? (
                    <div className="mt-2 flex items-start gap-3">
                      <div className="relative aspect-video w-40 overflow-hidden rounded-lg border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.coverUrl}
                          alt="封面预览"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => set("coverUrl", "")}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-red-600"
                        title="移除封面图"
                      >
                        <X className="h-3.5 w-3.5" />
                        移除
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="md:col-span-2">
                  <label className={label}>标签</label>
                  <div className="mt-1">
                    <TagInput
                      value={form.tags}
                      onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                      allTags={allTags}
                      placeholder="输入标签后回车添加，可下拉选择已有标签"
                    />
                  </div>
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

        {/* 封面图媒体选择器（图库选择 / 上传） */}
        <MediaPicker
          open={showCoverPicker}
          onClose={() => setShowCoverPicker(false)}
          onSelect={(url) => set("coverUrl", url)}
        />

        {/* 底部按钮：上一步左下角，下一步/保存右下角 */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          {/* 左下角：上一步（第一步不显示）/ 返回列表 */}
          <div className="flex gap-3">
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
            <button
              key="back-btn"
              type="button"
              onClick={goToList}
              className="rounded-lg border border-border px-4 py-2 text-base hover:bg-accent transition-colors"
            >
              返回列表
            </button>
          </div>

          {/* 右下角：下一步（非最后一步）或 保存（最后一步） */}
          <div className="flex gap-3">
            {currentStep < EDITOR_STEPS.length ? (
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
                {loading ? "保存中…" : postId ? "保存修改" : "创建文章"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
