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
  RotateCcw,
  Check,
} from "lucide-react";
import type {
  Guide,
  GuideCondition,
  GuideTargetCondition,
} from "@/lib/types/guides";
import {
  GuideStatus,
  GuideConditionOp,
  GUIDE_STATUS_VALUES,
  GUIDE_CONDITION_OPS,
  normalizeTargetCondition,
} from "@/lib/types/guides";
import { GUIDE_EVENT_ANCHORS } from "@/lib/guide-events";

/**
 * 引导管理组件（guiders 表 CRUD）
 *
 * - 列表：标题 / guideKey / 页面 / 触发条件 / 状态 / 优先级 / 步骤数 / 操作
 * - 新建 / 编辑表单：steps 用 JSON 编辑器；触发条件用结构化行式表单
 * - 触发条件：{logic, conditions[]}，event_click 的 value 从埋点注册表下拉
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

/** 条件字段下拉选项 */
const FIELD_OPTIONS = [
  { value: "event_click", label: "event_click（点击锚点元素）" },
  { value: "page", label: "page（适用页面）" },
  { value: "click_count", label: "click_count.（点击累计次数）" },
  { value: "user_age_days", label: "user_age_days（注册天数）" },
];

const OP_LABEL: Record<GuideConditionOp, string> = {
  eq: "等于 (eq)",
  gte: "大于等于 (gte)",
  lte: "小于等于 (lte)",
  exists: "存在 (exists)",
};

/** 条件编辑行 */
function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: GuideCondition;
  onChange: (next: GuideCondition) => void;
  onRemove: () => void;
}) {
  const isClickCount = cond.field.startsWith("click_count.");
  const field = isClickCount ? "click_count" : cond.field;
  const clickAnchor = isClickCount
    ? cond.field.slice("click_count.".length)
    : "";

  const setField = (next: string) => {
    if (next === "click_count") {
      onChange({
        ...cond,
        field: clickAnchor ? `click_count.${clickAnchor}` : "click_count.",
        op: cond.op ?? GuideConditionOp.GTE,
        value: cond.value ?? 1,
      });
    } else {
      onChange({
        ...cond,
        field: next,
        op:
          next === "user_age_days"
            ? GuideConditionOp.GTE
            : GuideConditionOp.EQ,
        value:
          next === "event_click"
            ? GUIDE_EVENT_ANCHORS[0]?.target ?? ""
            : next === "user_age_days"
              ? 3
              : cond.value ?? "",
      });
    }
  };

  const setClickAnchor = (anchor: string) => {
    onChange({
      ...cond,
      field: `click_count.${anchor}`,
      value: cond.value ?? 1,
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
      <select
        value={field}
        onChange={(e) => setField(e.target.value)}
        className={`${inputClass} w-52`}
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {isClickCount && (
        <input
          value={clickAnchor}
          onChange={(e) => setClickAnchor(e.target.value.trim())}
          className={`${inputClass} flex-1 font-mono text-xs`}
          placeholder="锚点名（data-guide，如 reveal-view）"
        />
      )}

      <select
        value={cond.op}
        onChange={(e) =>
          onChange({ ...cond, op: e.target.value as GuideConditionOp })
        }
        className={`${inputClass} w-36`}
      >
        {GUIDE_CONDITION_OPS.map((op) => (
          <option key={op} value={op}>
            {OP_LABEL[op]}
          </option>
        ))}
      </select>

      {cond.op !== GuideConditionOp.EXISTS &&
        (field === "event_click" ? (
          <select
            value={typeof cond.value === "string" ? cond.value : ""}
            onChange={(e) => onChange({ ...cond, value: e.target.value })}
            className={`${inputClass} flex-1`}
          >
            {GUIDE_EVENT_ANCHORS.map((a) => (
              <option key={a.target} value={a.target}>
                {a.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={
              field === "user_age_days" || field === "click_count"
                ? "number"
                : "text"
            }
            value={cond.value ?? ""}
            onChange={(e) =>
              onChange({
                ...cond,
                value:
                  field === "user_age_days" || field === "click_count"
                    ? Number(e.target.value)
                    : e.target.value,
              })
            }
            className={`${inputClass} flex-1`}
            placeholder={field === "page" ? "/settings" : "数值"}
          />
        ))}

      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
        title="删除条件"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

interface FormState {
  id?: string;
  guideKey: string;
  title: string;
  page: string;
  priority: number;
  status: GuideStatus;
  logic: "and" | "or";
  conditions: GuideCondition[];
  stepsJson: string;
}

const EMPTY_FORM: FormState = {
  guideKey: "",
  title: "",
  page: "",
  priority: 0,
  status: GuideStatus.DRAFT,
  logic: "and",
  conditions: [
    {
      field: "event_click",
      op: GuideConditionOp.EQ,
      value: GUIDE_EVENT_ANCHORS[0]?.target ?? "",
    },
    { field: "page", op: GuideConditionOp.EQ, value: "/settings" },
  ],
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
  /** 重置进度反馈：guideKey → 已重置提示（3 秒后消失） */
  const [resetDone, setResetDone] = useState<string | null>(null);

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
    const tc = normalizeTargetCondition(g.targetCondition);
    setForm({
      id: g.id,
      guideKey: g.guideKey,
      title: g.title,
      page: g.page,
      priority: g.priority,
      status: g.status,
      logic: tc?.logic ?? "and",
      conditions: tc?.conditions ?? [],
      stepsJson: JSON.stringify(g.steps, null, 2),
    });
    setError("");
    setEditing(true);
  };

  /** 条件行有效性（click_count 需有锚点；非 exists 需有 value） */
  const conditionValid = (c: GuideCondition): boolean => {
    if (!c.field) return false;
    if (
      c.field.startsWith("click_count.") &&
      c.field.length <= "click_count.".length
    ) {
      return false;
    }
    if (c.field === "click_count.") return false;
    if (
      c.op !== GuideConditionOp.EXISTS &&
      (c.value === undefined || c.value === null || c.value === "")
    ) {
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    setError("");
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
    if (
      form.conditions.length === 0 ||
      !form.conditions.every(conditionValid)
    ) {
      setError(
        "触发条件至少一条，且 click_count 需填锚点名、非 exists 条件需填 value"
      );
      return;
    }

    setSaving(true);
    try {
      const targetCondition: GuideTargetCondition = {
        logic: form.logic,
        conditions: form.conditions.map((c) => ({
          field: c.field,
          op: c.op,
          value: c.value,
        })),
      };
      const payload = {
        guideKey: form.guideKey.trim(),
        title: form.title.trim(),
        page: form.page.trim(),
        priority: Number(form.priority) || 0,
        status: form.status,
        steps,
        targetCondition,
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

  /** 重置当前用户某引导的进度（清空 skipped/completed，可重新触发） */
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
                  <th className="pb-2 pr-4 font-medium">触发条件</th>
                  <th className="pb-2 pr-4 font-medium">优先级</th>
                  <th className="pb-2 pr-4 font-medium">步骤</th>
                  <th className="pb-2 pr-4 font-medium">状态</th>
                  <th className="pb-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((g) => {
                  const tc = normalizeTargetCondition(g.targetCondition);
                  const condSummary = tc
                    ? tc.conditions.map((c) => c.field).join(" · ")
                    : "—";
                  return (
                    <tr
                      key={g.id}
                      className="border-b border-border/50 last:border-0"
                    >
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
                        <span className="font-mono text-xs">{condSummary}</span>
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
                              title="重置我的进度（可重新触发）"
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
            </div>

            {/* 触发条件：结构化行式表单 */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass}>触发条件（target_condition）</label>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>满足逻辑：</span>
                  <select
                    value={form.logic}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        logic: e.target.value as "and" | "or",
                      })
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="and">全部满足 (and)</option>
                    <option value="or">任一满足 (or)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        conditions: [
                          ...form.conditions,
                          {
                            field: "event_click",
                            op: GuideConditionOp.EQ,
                            value: GUIDE_EVENT_ANCHORS[0]?.target ?? "",
                          },
                        ],
                      })
                    }
                    className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加条件
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {form.conditions.map((c, i) => (
                  <ConditionRow
                    key={i}
                    cond={c}
                    onChange={(next) =>
                      setForm({
                        ...form,
                        conditions: form.conditions.map((x, j) =>
                          j === i ? next : x
                        ),
                      })
                    }
                    onRemove={() =>
                      setForm({
                        ...form,
                        conditions: form.conditions.filter((_, j) => j !== i),
                      })
                    }
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                event_click 的 value 与 data-guide 锚点、埋点上报用同一标识；
                click_count 条件需 user_events 表有该锚点点击记录。
              </p>
            </div>

            <div className="mt-4">
              <label className={labelClass}>
                steps（JSON，每项：id / target(data-guide 锚点名) / title / content / placement? / nextRoute?）
              </label>
              <textarea
                value={form.stepsJson}
                onChange={(e) => setForm({ ...form, stepsJson: e.target.value })}
                rows={10}
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
