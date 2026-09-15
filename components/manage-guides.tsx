"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Rocket,
  Archive,
  Loader2,
  X,
} from "lucide-react";
import type { Guide } from "@/lib/types/guides";
import { GuideStatus, GUIDE_STATUS_VALUES } from "@/lib/types/guides";

/**
 * 引导管理组件（guiders 表 CRUD）
 *
 * - 列表：标题 / guideKey / 页面 / 状态 / 优先级 / 步骤数 / 操作
 * - 新建 / 编辑表单（steps 使用 JSON 编辑器 + 校验）
 * - 状态切换：发布（published）/ 归档（archived）
 */

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all";
const labelClass = "block text-sm font-medium mb-1.5";

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

interface FormState {
  id?: string;
  guideKey: string;
  title: string;
  page: string;
  priority: number;
  status: GuideStatus;
  event: string;
  conditionPage: string;
  stepsJson: string;
}

const EMPTY_FORM: FormState = {
  guideKey: "",
  title: "",
  page: "",
  priority: 0,
  status: GuideStatus.DRAFT,
  event: "",
  conditionPage: "",
  stepsJson: JSON.stringify(
    [
      {
        id: "step_1",
        target: "example-anchor",
        title: "第一步",
        content: "说明文字（支持纯文本）",
        placement: "bottom",
      },
    ],
    null,
    2
  ),
};

export function ManageGuides() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadGuides = useCallback(async () => {
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

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError("");
    setEditing(true);
  };

  const openEdit = (g: Guide) => {
    setForm({
      id: g.id,
      guideKey: g.guideKey,
      title: g.title,
      page: g.page,
      priority: g.priority,
      status: g.status,
      event: g.targetCondition?.event ?? "",
      conditionPage: g.targetCondition?.page ?? "",
      stepsJson: JSON.stringify(g.steps, null, 2),
    });
    setError("");
    setEditing(true);
  };

  const handleSave = async () => {
    setError("");
    // 校验
    if (!form.guideKey.trim() || !form.title.trim() || !form.page.trim()) {
      setError("guideKey / title / page 必填");
      return;
    }
    let steps: unknown;
    try {
      steps = JSON.parse(form.stepsJson);
    } catch {
      setError("steps JSON 格式错误");
      return;
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      setError("steps 必须是非空数组");
      return;
    }
    for (const s of steps as Array<Record<string, unknown>>) {
      if (
        typeof s.id !== "string" ||
        typeof s.target !== "string" ||
        typeof s.title !== "string" ||
        typeof s.content !== "string"
      ) {
        setError("steps 每项需包含 id / target / title / content 字符串字段");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        guideKey: form.guideKey.trim(),
        title: form.title.trim(),
        page: form.page.trim(),
        priority: Number(form.priority) || 0,
        status: form.status,
        steps,
        targetCondition:
          form.event.trim() || form.conditionPage.trim()
            ? {
                event: form.event.trim() || undefined,
                page: form.conditionPage.trim() || undefined,
              }
            : null,
      };
      const url = form.id
        ? `/api/admin/guides/${form.id}`
        : "/api/admin/guides";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      setEditing(false);
      await loadGuides();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (g: Guide, next: GuideStatus) => {
    const res = await fetch(`/api/admin/guides/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) await loadGuides();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/guides/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConfirmDelete(null);
      await loadGuides();
    }
  };

  return (
    <div className="space-y-6">
      {/* 列表 */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">引导列表</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              配置存于 guiders 表，页面通过 data-guide 锚点声明定位目标。
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新建引导
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            加载中…
          </div>
        ) : guides.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            暂无引导配置，点击右上角「新建引导」创建。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">标题</th>
                  <th className="pb-2 pr-4 font-medium">guideKey</th>
                  <th className="pb-2 pr-4 font-medium">页面</th>
                  <th className="pb-2 pr-4 font-medium">优先级</th>
                  <th className="pb-2 pr-4 font-medium">步骤</th>
                  <th className="pb-2 pr-4 font-medium">状态</th>
                  <th className="pb-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((g) => (
                  <tr key={g.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">
                      {g.title}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                      {g.guideKey}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {g.page}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {g.priority}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {g.steps.length} 步
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[g.status]}`}
                      >
                        {STATUS_LABEL[g.status]}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
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
                        {confirmDelete === g.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(g.id)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
                            >
                              确认
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(g.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新建 / 编辑表单 */}
      {editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditing(false)}
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {form.id ? "编辑引导" : "新建引导"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>标题</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="如：设置密码引导"
                />
              </div>
              <div>
                <label className={labelClass}>
                  guideKey（带版本号，如 reveal_password_setup_v1）
                </label>
                <input
                  value={form.guideKey}
                  onChange={(e) =>
                    setForm({ ...form, guideKey: e.target.value })
                  }
                  className={`${inputClass} font-mono`}
                  placeholder="reveal_password_setup_v1"
                />
              </div>
              <div>
                <label className={labelClass}>页面（相对后台路径）</label>
                <input
                  value={form.page}
                  onChange={(e) => setForm({ ...form, page: e.target.value })}
                  className={inputClass}
                  placeholder="/settings"
                />
              </div>
              <div>
                <label className={labelClass}>优先级（小者先触发）</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: Number(e.target.value) })
                  }
                  className={inputClass}
                />
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>触发事件</label>
                  <input
                    value={form.event}
                    onChange={(e) =>
                      setForm({ ...form, event: e.target.value })
                    }
                    className={inputClass}
                    placeholder="reveal-click"
                  />
                </div>
                <div>
                  <label className={labelClass}>触发页面</label>
                  <input
                    value={form.conditionPage}
                    onChange={(e) =>
                      setForm({ ...form, conditionPage: e.target.value })
                    }
                    className={inputClass}
                    placeholder="/settings"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>
                steps（JSON，每项：id / target(data-guide 锚点名) / title / content / placement? / nextRoute?）
              </label>
              <textarea
                value={form.stepsJson}
                onChange={(e) => setForm({ ...form, stepsJson: e.target.value })}
                rows={12}
                className={`${inputClass} font-mono text-xs`}
              />
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
