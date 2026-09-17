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
import type {
  Guide,
  GuideCondition,
  GuideTargetCondition,
  GuideStep,
} from "@/lib/types/guides";
import {
  GuideStatus,
  GuideConditionOp,
  GUIDE_STATUS_VALUES,
  GUIDE_CONDITION_OPS,
  normalizeTargetCondition,
} from "@/lib/types/guides";
import { GUIDE_EVENT_ANCHORS } from "@/lib/guide-events";
import { AdminLoadingState, AdminEmptyState } from "@/components/admin/status";
import { AdminModal } from "@/components/admin/modal";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ADMIN_PAGES } from "@/lib/shared/admin-pages";
import { useToast } from "@/components/toast";
import { AdminSearchInput } from "@/components/admin/search-input";

/**
 * 引导管理组件（guiders 表 CRUD）
 *
 * - 列表：标题 / guideKey / 页面 / 触发条件 / 状态 / 优先级 / 步骤数 / 操作
 * - 新建 / 编辑表单：触发条件用结构化行式表单；steps 用步骤卡片编辑器（自动生成 JSON）
 * - 进度重置：每行可重置当前登录账号的引导进度（跳过/完成清空后可重新触发）
 */

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all";
const labelClass = "block text-sm font-medium text-foreground";
const helpClass = "mt-1 text-xs text-muted-foreground leading-relaxed";

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
  { value: "event_click", label: "event_click（用户点击了元素）" },
  { value: "page", label: "page（适用页面）" },
  { value: "click_count", label: "click_count.（点击次数）" },
  { value: "user_age_days", label: "user_age_days（注册天数）" },
];

const FIELD_HELP: Record<string, string> = {
  event_click:
    "用户点击了某个元素就触发。value 选「点击的锚点」（即该元素上的 data-guide 标记，与前端埋点用同一标识）。",
  page: "只在指定后台页面触发。value 从下方下拉选择（选项由系统路由自动生成）。",
  click_count:
    "点击累计次数达到才触发（需先在用户行为表有点击记录）。在中间框填锚点名，右边填次数。",
  user_age_days:
    "账号注册满多少天才触发。value 填天数（如 3 = 注册满 3 天）。",
};

const OP_LABEL: Record<GuideConditionOp, string> = {
  eq: "等于 (eq)",
  gte: "大于等于 (gte)",
  lte: "小于等于 (lte)",
  exists: "存在 (exists)",
};

/** 不同字段允许的操作符（页面/点击事件只有「等于」；数字字段支持比较） */
const OP_BY_FIELD: Record<string, GuideConditionOp[]> = {
  event_click: [GuideConditionOp.EQ],
  page: [GuideConditionOp.EQ],
  user_age_days: [GuideConditionOp.EQ, GuideConditionOp.GTE, GuideConditionOp.LTE],
  click_count: [GuideConditionOp.EQ, GuideConditionOp.GTE, GuideConditionOp.LTE],
};

/** 切换字段时的默认值（数据隔离：切字段不沿用上一字段的值） */
const DEFAULT_VALUE_BY_FIELD: Record<string, string | number> = {
  event_click: "",
  page: "",
  user_age_days: 3,
  click_count: 1,
};

const PLACEMENT_OPTIONS = [
  { value: "bottom", label: "下方" },
  { value: "top", label: "上方" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
];

/** 条件编辑行 */
function ConditionRow({
  cond,
  onChange,
  onRemove,
  condIndex,
  guideId,
  page,
  adminPath,
}: {
  cond: GuideCondition;
  onChange: (next: GuideCondition) => void;
  onRemove: () => void;
  /** 条件下标（拾取回填用） */
  condIndex: number;
  /** 引导 id（未保存时为 null，拾取需先保存） */
  guideId: string | null;
  /** 引导适用页面（相对后台路径，如 /settings） */
  page: string;
  adminPath: string;
}) {
  const isClickCount = cond.field.startsWith("click_count.");
  const field = isClickCount ? "click_count" : cond.field;
  const clickAnchor = isClickCount
    ? cond.field.slice("click_count.".length)
    : "";

  const setField = (next: string) => {
    // 数据隔离：切换字段时重置操作符与值，不沿用上一字段的数据
    if (next === "click_count") {
      onChange({
        ...cond,
        field: `click_count.`,
        op: GuideConditionOp.GTE,
        value: 1,
      });
    } else {
      onChange({
        ...cond,
        field: next,
        op: OP_BY_FIELD[next]?.[0] ?? GuideConditionOp.EQ,
        value: DEFAULT_VALUE_BY_FIELD[next] ?? "",
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
    <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
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
            className={`${inputClass} min-w-[160px] flex-1 font-mono text-xs`}
            placeholder="锚点名（如 reveal-view）"
          />
        )}

        <select
          value={cond.op}
          onChange={(e) =>
            onChange({ ...cond, op: e.target.value as GuideConditionOp })
          }
          className={`${inputClass} w-36`}
        >
          {(OP_BY_FIELD[field] ?? [GuideConditionOp.EQ]).map((op) => (
            <option key={op} value={op}>
              {OP_LABEL[op]}
            </option>
          ))}
        </select>

        {field === "event_click" ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <select
              value={
                typeof cond.value === "string" &&
                GUIDE_EVENT_ANCHORS.some((a) => a.target === cond.value)
                  ? (cond.value as string)
                  : ""
              }
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
              className={`${inputClass} min-w-[160px] flex-1`}
              title="已埋点锚点（需页面有 data-guide 标记）；也可用右侧「拾取元素」选任意元素生成选择器"
            >
              <option value="">已埋点锚点…</option>
              {GUIDE_EVENT_ANCHORS.map((a) => (
                <option key={a.target} value={a.target}>
                  {a.label}（{a.target}）
                </option>
              ))}
            </select>
            {guideId && page ? (
              <a
                href={`/${adminPath}${page.startsWith("/") ? "" : "/"}${page}?guide-pick=1&guide_id=${guideId}&cond_idx=${condIndex}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-medium transition hover:bg-accent"
                title="跳到目标页面点选元素，保存为触发条件"
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                拾取元素
              </a>
            ) : (
              <span
                className="inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-lg border border-input bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
                title="保存引导后可拾取"
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                拾取元素
              </span>
            )}
            {typeof cond.value === "string" &&
              cond.value !== "" &&
              !GUIDE_EVENT_ANCHORS.some((a) => a.target === cond.value) && (
                <span className="inline-flex min-w-0 max-w-[200px] items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 font-mono text-[11px] text-primary">
                  <span className="truncate">{cond.value}</span>
                  <button
                    type="button"
                    onClick={() => onChange({ ...cond, value: "" })}
                    className="text-primary/60 transition-colors hover:text-primary"
                    title="清除"
                    aria-label="清除触发元素"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
          </div>
        ) : field === "page" ? (
          <select
            value={
              typeof cond.value === "string" &&
              (ADMIN_PAGES.some((p) => p.path === cond.value) || cond.value === "")
                ? (cond.value as string)
                : "__custom__"
            }
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...cond,
                value: v === "__custom__" ? (cond.value as string) : v,
              });
            }}
            className={`${inputClass} min-w-[200px] flex-1`}
          >
            <option value="">请选择页面</option>
            {ADMIN_PAGES.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path === "/" ? "/（首页）" : p.path} · {p.label}
              </option>
            ))}
            {typeof cond.value === "string" &&
              cond.value !== "" &&
              !ADMIN_PAGES.some((p) => p.path === cond.value) && (
                <option value="__custom__">{cond.value}（手写值）</option>
              )}
          </select>
        ) : (
          <input
            type="number"
            min={0}
            value={typeof cond.value === "number" ? cond.value : ""}
            onChange={(e) =>
              onChange({
                ...cond,
                value:
                  e.target.value === ""
                    ? 0
                    : Number(e.target.value),
              })
            }
            className={`${inputClass} min-w-[140px] flex-1`}
            placeholder={field === "click_count" ? "次数，如 1" : "天数，如 3"}
          />
        )}

        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
          title="删除条件"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {FIELD_HELP[field] && (
        <p className="px-1 text-xs text-muted-foreground/90 leading-relaxed">
          {FIELD_HELP[field]}
        </p>
      )}
    </div>
  );
}

/** 步骤编辑卡片（结构化编辑，保存时自动组装 JSON） */
function StepEditor({
  steps,
  onChange,
  guideId,
  page,
  adminPath,
  pages,
}: {
  steps: StepForm[];
  onChange: (next: StepForm[]) => void;
  /** 引导 id（未保存时为 null，拾取需先保存） */
  guideId: string | null;
  /** 引导适用页面（相对后台路径，如 /settings） */
  page: string;
  adminPath: string;
  /** 后台页面列表（nextRoute 下拉选择） */
  pages: { path: string; label: string }[];
}) {
  const setStep = (i: number, patch: Partial<StepForm>) => {
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    onChange([
      ...steps,
      {
        id: `step_${steps.length + 1}`,
        target: "",
        title: "",
        content: "",
        placement: "bottom",
        nextRoute: "",
      },
    ]);
  };

  const removeStep = (i: number) => {
    onChange(
      steps
        .filter((_, j) => j !== i)
        .map((s, j) => ({ ...s, id: `step_${j + 1}` }))
    );
  };

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              步骤 {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeStep(i)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
              title="删除该步骤"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={`${labelClass} inline-flex items-center gap-1`}>
                高亮元素（target）
                <span
                  className="inline-flex shrink-0 cursor-help"
                  title="引导指向哪个元素。填该元素上的 data-guide 值（如 reveal-view）；下方下拉是已埋点锚点，可直接选。"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </label>
              <input
                list="guide-anchor-options"
                value={s.target}
                onChange={(e) => setStep(i, { target: e.target.value })}
                className={`${inputClass} font-mono text-xs`}
                placeholder="data-guide 锚点名，如 reveal-view"
              />
              <p className={helpClass}>
                引导要指向哪个元素。填该元素上的 data-guide 标记值，或点下方「拾取锚点」在目标页面点选生成动态选择器。
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {guideId && page ? (
                  <a
                    href={`/${adminPath}${page.startsWith("/") ? "" : "/"}${page}?guide-pick=1&guide_id=${guideId}&step_id=${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    拾取锚点
                  </a>
                ) : (
                  <span
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-input bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"
                    title="保存引导后可跳到目标页面拾取锚点"
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    拾取锚点（先保存引导）
                  </span>
                )}
                {s.selector && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 font-mono text-[11px] text-primary">
                    <span className="max-w-[240px] truncate">{s.selector}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setStep(i, { selector: undefined, selectorMeta: undefined })
                      }
                      className="text-primary/60 transition-colors hover:text-primary"
                      title="清除动态选择器"
                      aria-label="清除动态选择器"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>标题（title）</label>
              <input
                value={s.title}
                onChange={(e) => setStep(i, { title: e.target.value })}
                className={inputClass}
                placeholder="引导卡片的标题，如：需要先设置密码"
              />
            </div>
            <div>
              <label className={labelClass}>卡片位置（placement）</label>
              <select
                value={s.placement}
                onChange={(e) => setStep(i, { placement: e.target.value })}
                className={inputClass}
              >
                {PLACEMENT_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className={helpClass}>引导卡片出现在高亮元素的上/下/左/右。</p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>说明文字（content）</label>
              <textarea
                value={s.content}
                onChange={(e) => setStep(i, { content: e.target.value })}
                rows={2}
                className={inputClass}
                placeholder="告诉用户这一步要做什么"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={`${labelClass} inline-flex items-center gap-1`}>
                下一步跳转页面（nextRoute，可选）
                <span
                  className="inline-flex shrink-0 cursor-help"
                  title="点击「下一步」后跳转到的后台相对路径（如 /account），用于跨页引导。留空则在当前页高亮下一个元素。"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </label>
              <select
                value={
                  s.nextRoute && pages.some((p) => p.path === s.nextRoute)
                    ? s.nextRoute
                    : s.nextRoute
                      ? "__custom__"
                      : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setStep(i, { nextRoute: v === "__custom__" ? s.nextRoute : v });
                }}
                className={inputClass}
              >
                <option value="">不跳转（下一步在当前页高亮）</option>
                {pages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path === "/" ? "/（首页）" : p.path} · {p.label}
                  </option>
                ))}
                {s.nextRoute && !pages.some((p) => p.path === s.nextRoute) && (
                  <option value="__custom__">{s.nextRoute}（手写值）</option>
                )}
              </select>
              <p className={helpClass}>
                点击「下一步」后跳转到的后台页面（选项由服务端扫描路由自动生成，不含 adminSlug 前缀），用于跨页引导；不选则下一步只在当前页高亮下一个元素。
              </p>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-fg-faint hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        添加步骤
      </button>
    </div>
  );
}

/** 步骤表单（编辑时使用，保存时映射为 GuideStep[]） */
interface StepForm {
  id: string;
  target: string;
  title: string;
  content: string;
  placement: string;
  nextRoute: string;
  /** 动态选择器（拾取生成，target 留空时的兜底定位） */
  selector?: string;
  selectorMeta?: GuideStep["selectorMeta"];
}

const emptyStepForm = (): StepForm => ({
  id: "step_1",
  target: "",
  title: "",
  content: "",
  placement: "bottom",
  nextRoute: "",
});

/** GuideStep[] → StepForm[]（兼容手写 JSON 缺字段） */
const toStepForms = (steps: GuideStep[]): StepForm[] =>
  steps.map((s, i) => ({
    id: s.id || `step_${i + 1}`,
    target: s.target ?? "",
    title: s.title ?? "",
    content: s.content ?? "",
    placement: s.placement ?? "bottom",
    nextRoute: s.nextRoute ?? "",
    selector: s.selector,
    selectorMeta: s.selectorMeta,
  }));

interface FormState {
  id?: string;
  guideKey: string;
  title: string;
  page: string;
  priority: number;
  status: GuideStatus;
  logic: "and" | "or";
  conditions: GuideCondition[];
  steps: StepForm[];
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
  steps: [emptyStepForm()],
};

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
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
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
      steps: toStepForms(g.steps),
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
      setError("请填写标题、guideKey、页面（必填项）");
      return;
    }
    if (form.status === GuideStatus.PUBLISHED && form.steps.length === 0) {
      setError("发布前至少需要一个步骤（可先保存草稿，再用拾取锚点补充）");
      return;
    }
    // steps 校验（结构化表单 → GuideStep[]）
    const steps: GuideStep[] = [];
    for (const [i, s] of form.steps.entries()) {
      if ((!s.target.trim() && !s.selector?.trim()) || !s.title.trim() || !s.content.trim()) {
        setError(`步骤 ${i + 1} 未填写完整：高亮元素（data-guide 或动态选择器）/ 标题 / 说明文字必填`);
        return;
      }
      steps.push({
        id: s.id.trim() || `step_${i + 1}`,
        target: s.target.trim(),
        title: s.title.trim(),
        content: s.content.trim(),
        placement: (s.placement as GuideStep["placement"]) || "bottom",
        nextRoute: s.nextRoute.trim() || undefined,
        selector: s.selector?.trim() || undefined,
        selectorMeta: s.selectorMeta,
      });
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
      setForm(EMPTY_FORM);
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
    <div className="space-y-6">
      <AdminPageHeader
        title="引导管理"
        description="页面通过 data-guide 锚点声明定位目标；「重置」只清空当前登录账号的引导进度（跳过/完成状态移除后，该引导可重新触发）。"
        actions={
          <>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">新建引导</span>
            </button>
            <button
              type="button"
              onClick={loadGuides}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
              title="刷新列表"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>
          </>
        }
      />

      {/* 工具行：搜索 */}
      <AdminSearchInput
        value={search}
        onChange={setSearch}
        placeholder="搜索标题、guideKey 或页面…"
        className="mb-4 max-w-md"
      />

      {loading ? (
          <AdminLoadingState />
        ) : filteredGuides.length === 0 ? (
          <AdminEmptyState
            title={search ? "没有找到匹配的引导" : "暂无引导配置"}
            description={search ? undefined : "点击右上角「新建引导」创建"}
          />
        ) : (
          <>
          {/* 桌面端：表格（与其他管理页统一样式） */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-surface">
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
                      <td className="px-4 py-3 text-muted-foreground">
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
          <div className="md:hidden rounded-xl border border-border bg-surface divide-y divide-border">
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
        )}

      {/* 新建 / 编辑表单 */}
      {editing && (
        <AdminModal
          open
          title={form.id ? "编辑引导" : "新建引导"}
          onClose={() => {
            setEditing(false);
            setForm(EMPTY_FORM);
          }}
          maxWidth="3xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm(EMPTY_FORM);
                }}
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

            {/* 触发条件 */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass}>
                  触发条件（什么时候弹这个引导）
                </label>
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
                    condIndex={i}
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
                    guideId={form.id ?? null}
                    page={form.page}
                    adminPath={adminPath}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                每个条件三列：条件字段 → 比较方式 → 值。全部满足（and）指每个条件都成立才触发；
                任一满足（or）指满足其中一个就触发。
              </p>
            </div>

            {/* 引导步骤 */}
            <div className="mt-5">
              <label className={labelClass}>
                引导步骤（按顺序弹出的引导卡片）
              </label>
              <datalist id="guide-anchor-options">
                {GUIDE_EVENT_ANCHORS.map((a) => (
                  <option key={a.target} value={a.target}>
                    {a.label}
                  </option>
                ))}
              </datalist>
              <StepEditor
                steps={form.steps}
                onChange={(steps) => setForm({ ...form, steps })}
                guideId={form.id ?? null}
                page={form.page}
                adminPath={adminPath}
                pages={pages}
              />
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        </AdminModal>
      )}

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
    </div>
  );
}
