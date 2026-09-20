"use client";

/**
 * 引导触发条件编辑器（条件行 + 满足逻辑 + 添加/删除）
 *
 * 结构化行式表单：条件字段 → 比较方式 → 值。字段决定可用操作符与输入控件
 * （page 用下拉、数字字段用数字框、event_click 支持拾取元素生成选择器），
 * 切换字段时重置操作符与值（数据隔离）。校验规则见 lib/guides/validate.ts。
 */
import { Plus, Trash2, X, MousePointerClick } from "lucide-react";
import type { GuideCondition } from "@/lib/types/guides";
import { GuideConditionOp } from "@/lib/types/guides";
import { GUIDE_EVENT_ANCHORS } from "@/lib/guides/shared";
import { ADMIN_PAGES } from "@/lib/admin/shared";
import {
  inputClass,
  labelClass,
  FIELD_OPTIONS,
  FIELD_HELP,
  OP_LABEL,
  OP_BY_FIELD,
  DEFAULT_VALUE_BY_FIELD,
} from "@/lib/guides/client";

export function ConditionSection({
  logic,
  onLogicChange,
  conditions,
  onConditionsChange,
  guideId,
  page,
  adminPath,
  onPick,
}: {
  logic: "and" | "or";
  onLogicChange: (logic: "and" | "or") => void;
  conditions: GuideCondition[];
  onConditionsChange: (next: GuideCondition[]) => void;
  guideId: string | null;
  page: string;
  adminPath: string;
  /** 拾取触发条件元素：自动保存当前表单后跳目标页 */
  onPick: (params: { conditionIndex: number }) => void;
}) {
  const addCondition = () => {
    onConditionsChange([
      ...conditions,
      {
        field: "event_click",
        op: GuideConditionOp.EQ,
        value: GUIDE_EVENT_ANCHORS[0]?.target ?? "",
      },
    ]);
  };

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <label className={labelClass}>触发条件（什么时候弹这个引导）</label>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>满足逻辑：</span>
          <select
            value={logic}
            onChange={(e) => onLogicChange(e.target.value as "and" | "or")}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="and">全部满足 (and)</option>
            <option value="or">任一满足 (or)</option>
          </select>
          <button
            type="button"
            onClick={addCondition}
            className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            添加条件
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {conditions.map((c, i) => (
          <ConditionRow
            key={i}
            condIndex={i}
            cond={c}
            onChange={(next) =>
              onConditionsChange(
                conditions.map((x, j) => (j === i ? next : x))
              )
            }
            onRemove={() =>
              onConditionsChange(conditions.filter((_, j) => j !== i))
            }
            guideId={guideId}
            page={page}
            adminPath={adminPath}
            onPick={onPick}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        每个条件三列：条件字段 → 比较方式 → 值。全部满足（and）指每个条件都成立才触发；
        任一满足（or）指满足其中一个就触发。
      </p>
    </div>
  );
}

/** 条件编辑行 */
function ConditionRow({
  cond,
  onChange,
  onRemove,
  condIndex,
  guideId,
  page,
  adminPath,
  onPick,
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
  /** 拾取触发条件元素：自动保存当前表单后跳目标页 */
  onPick: (params: { conditionIndex: number }) => void;
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
            {page ? (
              <button
                type="button"
                onClick={() => onPick({ conditionIndex: condIndex })}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-medium transition hover:bg-accent"
                title="自动保存当前表单后，跳到目标页面点选元素保存为触发条件"
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                拾取元素
              </button>
            ) : (
              <span
                className="inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-lg border border-input bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
                title="请先在「页面」下拉选择本引导适用的后台页面，再拾取元素"
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
                value: e.target.value === "" ? 0 : Number(e.target.value),
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
