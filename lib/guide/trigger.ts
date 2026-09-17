import type { Guide, GuideProgress, GuideStep } from "@/lib/types/guides";
import {
  GuideProgressStatus,
  GUIDE_SKIP_COOLDOWN_DAYS,
  normalizeTargetCondition,
} from "@/lib/types/guides";
import {
  evaluateTargetCondition,
  needsServerData,
} from "@/lib/guides/conditions";

/**
 * Guide 触发决策模块（深模块：小接口 + 全部触发规则）
 *
 * 输入 guide + 上下文（页面/事件/进度）→ 输出"是否触发 + 是否需服务端精筛 + 续接步骤"。
 * 纯函数、无 DOM 依赖，可单测。DOM 定位（querySelector/waitForElement）与副作用（onborda/上报）
 * 留在 GuideEngine 薄壳。
 */

/** 步骤候选选择器（按优先级）：data-guide 埋点优先，selector 兜底 */
export function resolveStepSelectors(step: GuideStep): string[] {
  const list: string[] = [];
  if (step.target) list.push(`[data-guide="${step.target}"]`);
  if (step.selector) list.push(step.selector);
  return list;
}

/** skipped 是否已过冷却期（超过 N 天允许重新触发）；非 skipped / 无记录返回 false */
export function isSkippedExpired(progress?: GuideProgress | null): boolean {
  if (!progress || progress.status !== GuideProgressStatus.SKIPPED || !progress.updatedAt) {
    return false;
  }
  const days = (Date.now() - new Date(progress.updatedAt).getTime()) / 86_400_000;
  return days >= GUIDE_SKIP_COOLDOWN_DAYS;
}

export interface TriggerContext {
  /** 当前后台相对路径（如 /cron） */
  page: string;
  /** 事件触发时的事件名（固定 event_click）；页面加载场景缺省 */
  event?: string;
  /** 事件触发时的锚点值/选择器 */
  target?: string;
  /** 该引导的用户进度（无记录为 null） */
  progress?: GuideProgress | null;
  /** 页面加载场景允许续接 in_progress */
  resumeIfInProgress?: boolean;
}

export interface TriggerDecision {
  shouldTrigger: boolean;
  /** 含服务端条件（click_count / user_age_days），需要调 evaluate API 精筛 */
  needsServer: boolean;
  /** 事件触发（有被点击元素） */
  fromEvent: boolean;
  /** 续接步骤（in_progress 且 currentStep>0 时 >0，否则 0=从头） */
  resumeStep: number;
}

const NO_TRIGGER = (fromEvent: boolean): TriggerDecision => ({
  shouldTrigger: false,
  needsServer: false,
  fromEvent,
  resumeStep: 0,
});

/** 行为触发（guide:trigger 事件）：本地按 event_click + page 条件粗筛 */
export function evaluateEventTrigger(
  guide: Guide,
  ctx: Pick<TriggerContext, "page" | "event" | "target">
): boolean {
  const tc = normalizeTargetCondition(guide.targetCondition);
  if (!tc) return false;
  // 本地可判条件（event_click / page）先过一遍；服务端条件不影响粗筛
  const local = tc.conditions.filter(
    (c) => c.field === "event_click" || c.field === "page"
  );
  if (local.length === 0) return false;
  return evaluateTargetCondition(
    { logic: tc.logic, conditions: local },
    { event: ctx.event, target: ctx.target, page: ctx.page }
  );
}

/** 页面加载/路由切换自动触发：and 含 event_click 不自动（等点击）；or 去掉 event_click 后评估剩余条件 */
export function evaluateAutoTrigger(guide: Guide, page: string): boolean {
  const tc = normalizeTargetCondition(guide.targetCondition);
  const conditions = tc?.conditions ?? [];
  const hasEventClick = conditions.some((c) => c.field === "event_click");
  // and 逻辑含 event_click：必须点击才触发，不自动弹出
  if (hasEventClick && tc?.logic !== "or") return false;
  if (hasEventClick && tc) {
    // or 逻辑：去掉 event_click 后用剩余条件评估（任一满足即自动触发）
    const local = conditions.filter((c) => c.field !== "event_click");
    if (local.length === 0) return false;
    return evaluateTargetCondition(
      { logic: tc.logic, conditions: local },
      { page }
    );
  }
  // 无 event_click：页面匹配（guide.page 字段 或 page 条件）
  const tcPages = conditions
    .filter((c) => c.field === "page")
    .map((c) => String(c.value))
    .filter(Boolean);
  return [guide.page, ...tcPages].filter(Boolean).includes(page);
}

/** 综合决策：进度抑制 → 触发条件评估 → 续接步骤 */
export function decideTrigger(
  guide: Guide,
  ctx: TriggerContext
): TriggerDecision {
  const progress = ctx.progress ?? null;
  const fromEvent =
    typeof ctx.event === "string" && Boolean(ctx.event) && Boolean(ctx.target);

  // 已完成永久抑制；已跳过未过冷却期 → 不触发
  if (
    progress &&
    (progress.status === GuideProgressStatus.COMPLETED ||
      (progress.status === GuideProgressStatus.SKIPPED &&
        !isSkippedExpired(progress)))
  ) {
    return NO_TRIGGER(fromEvent);
  }

  const matched = fromEvent
    ? evaluateEventTrigger(guide, {
        page: ctx.page,
        event: ctx.event,
        target: ctx.target,
      })
    : evaluateAutoTrigger(guide, ctx.page);
  if (!matched) return NO_TRIGGER(fromEvent);

  const resumeStep =
    ctx.resumeIfInProgress &&
    progress?.status === GuideProgressStatus.IN_PROGRESS &&
    typeof progress.currentStep === "number" &&
    progress.currentStep > 0
      ? progress.currentStep
      : 0;

  return {
    shouldTrigger: true,
    needsServer: needsServerData(normalizeTargetCondition(guide.targetCondition)),
    fromEvent,
    resumeStep,
  };
}
