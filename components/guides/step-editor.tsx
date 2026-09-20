"use client";

/**
 * 引导步骤编辑器（结构化编辑，保存时由校验模块组装为 GuideStep[] JSON）
 *
 * 每步卡片：高亮元素（data-guide 或拾取生成的选择器）/ 标题 / 卡片位置 / 说明文字 /
 * 下一步跳转页面（跨页引导）。拾取锚点自动保存当前表单后跳目标页点选。
 */
import { Plus, Trash2, X, HelpCircle, MousePointerClick } from "lucide-react";
import { GUIDE_EVENT_ANCHORS } from "@/lib/guides/shared";
import {
  inputClass,
  labelClass,
  helpClass,
  PLACEMENT_OPTIONS,
  type StepForm,
} from "@/lib/guides/client";

export function StepEditor({
  steps,
  onChange,
  guideId,
  page,
  adminPath,
  pages,
  onPick,
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
  /** 拾取步骤锚点：自动保存当前表单后跳目标页 */
  onPick: (params: { stepId: string }) => void;
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
      <datalist id="guide-anchor-options">
        {GUIDE_EVENT_ANCHORS.map((a) => (
          <option key={a.target} value={a.target}>
            {a.label}
          </option>
        ))}
      </datalist>
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
                {page ? (
                  <button
                    type="button"
                    onClick={() => onPick({ stepId: s.id })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                    title="自动保存当前表单后，跳到目标页面点选元素生成选择器"
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    拾取锚点
                  </button>
                ) : (
                  <span
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-input bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"
                    title="请先在「页面」下拉选择本引导适用的后台页面，再拾取锚点"
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    拾取锚点（先选页面）
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
