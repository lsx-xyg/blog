"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Rocket,
  Archive,
  Loader2,
  X,
  RefreshCw,
  RotateCcw,
  Check,
  HelpCircle,
  MousePointerClick,
} from "lucide-react";
import type { Guide } from "@/lib/types/guides";
import {
  GuideStatus,
  GUIDE_STATUS_VALUES,
  normalizeTargetCondition,
} from "@/lib/types/guides";

import { AdminModal } from "@/components/admin/modal";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminListPage } from "@/components/admin/list-page";
import { CreateButton, RefreshButton } from "@/components/admin/action-buttons";
import { useToast } from "@/components/toast";
import { GuideMissesPanel } from "@/components/guide/misses-panel";

import { StepEditor } from "@/components/guide/step-editor";
import { ConditionSection } from "@/components/guide/condition-editor";
import { useGuideForm } from "@/components/guide/use-guide-form";
import {
  labelClass,
  inputClass,
  helpClass,
} from "@/lib/guides/form-meta";

/**
 * 引导管理组件（guiders 表 CRUD）
 *
 * - 列表：标题 / guideKey / 页面 / 触发条件 / 状态 / 优先级 / 步骤数 / 操作
 * - 新建 / 编辑表单：触发条件用结构化行式表单；steps 用步骤卡片编辑器（自动生成 JSON）
 * - 进度重置：每行可重置当前登录账号的引导进度（跳过/完成清空后可重新触发）
 */

const STATUS_STYLE: Record<GuideStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-500/10 text-green-600 dark:text-green-400",
  archived: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
};

const STATUS_LABEL: Record<GuideStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

/** 条件字段下拉选项 */

/** 条件编辑行 */
/** 步骤编辑卡片（结构化编辑，保存时自动组装 JSON） */
export function ManageGuides({
  adminPath,
  pages,
}: {
  adminPath: string;
  /** 后台页面列表（服务端扫描生成），供「页面」下拉选择 */
  pages: { path: string; label: string }[];
}) {
  const { showToast } = useToast();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 搜索过滤（标题 / guideKey / 页面）
  const filteredGuides = useMemo(() => {
    if (!search) return guides;
    const kw = search.toLowerCase();
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(kw) ||
        g.guideKey.toLowerCase().includes(kw) ||
        (g.page || "").toLowerCase().includes(kw),
    );
  }, [guides, search]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /** 重置进度反馈：guideKey → 已重置提示（3 秒后消失） */
  const [resetDone, setResetDone] = useState<string | null>(null);

  const loadGuides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/guides");
      if (res.ok) {
        const d = await res.json();
        setGuides(d.guides ?? []);
      }
    } catch {
      /* 静默 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  // 表单状态机（校验/保存/拾取流程收口在 use-guide-form + lib/guides/validate）
  const { saving, editing, form, setForm, error, handleSave, saveThenPick, openCreate, openEdit, closeForm } =
    useGuideForm({ adminPath, refresh: loadGuides });

  const toggleStatus = async (g: Guide, next: GuideStatus) => {
    const res = await fetch(`/api/admin/guides/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      showToast(
        next === GuideStatus.PUBLISHED
          ? "已发布"
          : next === GuideStatus.ARCHIVED
            ? "已归档"
            : "已恢复为草稿",
        "success"
      );
      await loadGuides();
      return;
    }
    const data = await res.json().catch(() => ({}));
    showToast(data.error || "状态切换失败", "error");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/guides/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConfirmDelete(null);
      await loadGuides();
    }
  };

  /** 重置当前账号（登录用户自己）某引导的进度 */
  const handleResetProgress = async (guideKey: string) => {
    const res = await fetch(
      `/api/admin/guides/progress?guideKey=${encodeURIComponent(guideKey)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setResetDone(guideKey);
      setTimeout(() => setResetDone(null), 3000);
    }
  };

  return (
    <>
    <AdminListPage
      title="引导管理"
      description="页面通过 data-guide 锚点声明定位目标；「重置」只清空当前登录账号的引导进度（跳过/完成状态移除后，该引导可重新触发）。"
      actions={
        <>
          <CreateButton onClick={openCreate} label="新建引导" />
          <RefreshButton onClick={loadGuides} loading={loading} />
        </>
      }
      search={{ value: search, onChange: setSearch, placeholder: "搜索标题、guideKey 或页面…" }}
      loading={loading}
      empty={
        filteredGuides.length === 0 ? {

          title: search ? "没有找到匹配的引导" : "暂无引导配置",
          description: search ? undefined : "点击右上角「新建引导」创建",
      
        } : null
      }
    >
      <>
          {/* 桌面端：表格（与其他管理页统一样式） */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">标题</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">guideKey</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">页面</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">触发条件</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">优先级</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">步骤</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">状态</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuides.map((g, rowIndex) => {
                  const tc = normalizeTargetCondition(g.targetCondition);
                  const condSummary = tc
                    ? tc.conditions.map((c) => c.field).join(" · ")
                    : "—";
                  return (
                    <tr
                      key={g.id}
                      className="border-b border-border/50 last:border-0 animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(rowIndex * 30, 300)}ms` }}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {g.title}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {g.guideKey}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {g.page}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground">
                        <span className="font-mono text-xs">{condSummary}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {g.priority}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {g.steps.length} 步
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[g.status]}`}
                        >
                          {STATUS_LABEL[g.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {g.status !== GuideStatus.PUBLISHED && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleStatus(g, GuideStatus.PUBLISHED)
                              }
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-green-600"
                              title="发布"
                            >
                              <Rocket className="h-4 w-4" />
                            </button>
                          )}
                          {g.status !== GuideStatus.ARCHIVED && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleStatus(g, GuideStatus.ARCHIVED)
                              }
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-yellow-600"
                              title="归档"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(g)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(g.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          {resetDone === g.guideKey ? (
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                              <Check className="h-3.5 w-3.5" />
                              已重置
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleResetProgress(g.guideKey)}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="重置当前账号进度（跳过/完成后可重新触发）"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* 移动端：卡片列表 */}
          <div className="md:hidden rounded-xl border border-border bg-card divide-y divide-border">
            {filteredGuides.map((g) => {
              const tc = normalizeTargetCondition(g.targetCondition);
              const condSummary = tc
                ? tc.conditions.map((c) => c.field).join(" · ")
                : "—";
              return (
                <div key={g.id} className="p-4 animate-fade-in-up">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{g.title}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{g.guideKey}</p>
                    </div>
                    <span
                      className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[g.status]}`}
                    >
                      {STATUS_LABEL[g.status]}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>页面：{g.page || "—"} · 触发：{condSummary}</p>
                    <p>优先级 {g.priority} · {g.steps.length} 步</p>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
                    {g.status !== GuideStatus.PUBLISHED && (
                      <button
                        type="button"
                        onClick={() => toggleStatus(g, GuideStatus.PUBLISHED)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-green-600"
                        title="发布"
                      >
                        <Rocket className="h-4 w-4" />
                      </button>
                    )}
                    {g.status !== GuideStatus.ARCHIVED && (
                      <button
                        type="button"
                        onClick={() => toggleStatus(g, GuideStatus.ARCHIVED)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-yellow-600"
                        title="归档"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetProgress(g.guideKey)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="重置当前账号进度"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(g.id)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
      </>
    </AdminListPage>

      {/* 新建 / 编辑表单 */}
      {editing && (
        <AdminModal
          open
          title={form.id ? "编辑引导" : "新建引导"}
          onClose={closeForm}
          maxWidth="3xl"
          footer={
            <>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中…
                  </>
                ) : (
                  "保存"
                )}
              </button>
            </>
          }
        >

            {/* 基本信息 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>标题</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="如：设置密码引导"
                />
                <p className={helpClass}>引导的名称，仅在管理页展示。</p>
              </div>
              <div>
                <label className={labelClass}>guideKey</label>
                <input
                  value={form.guideKey}
                  onChange={(e) =>
                    setForm({ ...form, guideKey: e.target.value })
                  }
                  className={`${inputClass} font-mono`}
                  placeholder="如 reveal_password_setup_v1"
                />
                <p className={helpClass}>
                  引导的唯一标识（带版本号）。改版时换新 key（如
                  _v2），已看过旧版的用户会自动重新触发。
                </p>
              </div>
              <div>
                <label className={labelClass}>页面</label>
                <select
                  value={
                    pages.some((p) => p.path === form.page)
                      ? form.page
                      : "__custom__"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, page: v === "__custom__" ? form.page : v });
                  }}
                  className={inputClass}
                >
                  {pages.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.path === "/" ? "/（首页）" : p.path} · {p.label}
                    </option>
                  ))}
                  {!pages.some((p) => p.path === form.page) && form.page && (
                    <option value="__custom__">
                      {form.page}（手写值，不在列表中）
                    </option>
                  )}
                </select>
                <p className={helpClass}>
                  引导适用的后台页面（不含 adminSlug 前缀，如 /settings）。选项由服务端扫描后台路由自动生成；如页面未收录可选「手写值」保留当前路径。
                </p>
              </div>
              <div>
                <label className={labelClass}>优先级</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) })
                  }
                  className={`${inputClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
                <p className={helpClass}>
                  同页面有多个引导可触发时，数字小的先显示。
                </p>
              </div>
              <div>
                <label className={labelClass}>状态</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as GuideStatus })
                  }
                  className={inputClass}
                >
                  {GUIDE_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <p className={helpClass}>
                  草稿不触发；发布后按触发条件生效；归档停用。
                </p>
              </div>
            </div>

            {/* 触发条件（结构化行式编辑器，逻辑/添加/删除收口在 condition-editor） */}
            <ConditionSection
              logic={form.logic}
              onLogicChange={(logic) => setForm({ ...form, logic })}
              conditions={form.conditions}
              onConditionsChange={(conditions) => setForm({ ...form, conditions })}
              guideId={form.id ?? null}
              page={form.page}
              adminPath={adminPath}
              onPick={saveThenPick}
            />

            {/* 引导步骤 */}
            <div className="mt-5">
              <label className={labelClass}>
                引导步骤（按顺序弹出的引导卡片）
              </label>
              <StepEditor
                steps={form.steps}
                onChange={(steps) => setForm({ ...form, steps })}
                guideId={form.id ?? null}
                page={form.page}
                adminPath={adminPath}
                pages={pages}
                onPick={saveThenPick}
              />
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        </AdminModal>
      )}

      {/* 失效选择器监控（#29） */}
      <GuideMissesPanel />

      {/* 删除确认弹窗（与其他管理页规范一致） */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除引导"
        description="删除后该引导配置将不可恢复，但不会影响已完成的用户进度记录。确定删除吗？"
        confirmLabel="删除"
        onConfirm={() => {
          if (confirmDelete) void handleDelete(confirmDelete);
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
}
