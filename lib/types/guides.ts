/**
 * 引导系统类型（guiders 表 + user_guide_progress 表）
 *
 * 领域术语见 CONTEXT.md「Onboarding Guide / Guide Step / Guide Anchor /
 * Guide Key / Guide Progress / Guide Manager」
 */

export const GuideStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;
export type GuideStatus = (typeof GuideStatus)[keyof typeof GuideStatus];
export const GUIDE_STATUS_VALUES = Object.values(GuideStatus) as GuideStatus[];

export const GuideProgressStatus = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  SKIPPED: "skipped",
} as const;
export type GuideProgressStatus =
  (typeof GuideProgressStatus)[keyof typeof GuideProgressStatus];
export const GUIDE_PROGRESS_STATUS_VALUES = Object.values(
  GuideProgressStatus
) as GuideProgressStatus[];

/** 引导跳过（skipped）后的冷却期（天），超过后允许重新触发；completed 永久抑制 */
export const GUIDE_SKIP_COOLDOWN_DAYS = 7;

/** 引导步骤（steps JSONB 中的单个元素） */
export interface GuideStep {
  id: string;
  /** data-guide 锚点名，前端用 [data-guide="<target>"] 定位（埋点优先，最稳） */
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** 下一步跳转路由（相对后台路径，如 /account），onborda 跨页步骤使用 */
  nextRoute?: string;
  /** 动态选择器（拾取生成）：data-guide 未命中时的兜底定位 */
  selector?: string;
  /** 选择器元信息（生成来源 + 时间，供失效监控/自动修复参考） */
  selectorMeta?: {
    /** 生成来源：id / semantic / class / path */
    source: "id" | "semantic" | "class" | "path";
    /** 生成时间 ISO 字符串 */
    generatedAt: string;
  };
}

/** 条件运算符 */
export const GuideConditionOp = {
  EQ: "eq",
  GTE: "gte",
  LTE: "lte",
  EXISTS: "exists",
} as const;
export type GuideConditionOp =
  (typeof GuideConditionOp)[keyof typeof GuideConditionOp];
export const GUIDE_CONDITION_OPS = Object.values(
  GuideConditionOp
) as GuideConditionOp[];

/**
 * 触发条件表达式（target_condition JSONB）
 *
 * 通用条件表达式：{logic, conditions[]}，conditions 每项为一条原子条件。
 * 示例：
 * {logic:"and", conditions:[
 *   {field:"event_click", op:"eq", value:"reveal-view"},
 *   {field:"page", op:"eq", value:"/settings"},
 *   {field:"click_count.reveal-view", op:"gte", value:1},
 *   {field:"user_age_days", op:"gte", value:3},
 * ]}
 *
 * 字段约定（field 与埋点/data-guide 用同一标识，见 lib/guide-events.ts）：
 * - event_click：用户点击了某锚点元素（value = data-guide 锚点值），实时行为触发
 * - page：适用页面（value = 后台相对路径前缀，如 /settings）
 * - click_count.<target>：用户点击某锚点的累计次数（服务端 user_events 统计）
 * - user_age_days：用户注册天数（服务端 users.created_at 计算）
 */
export interface GuideCondition {
  /** 条件字段（event_click / page / click_count.<target> / user_age_days） */
  field: string;
  op: GuideConditionOp;
  /** 比较值：字符串锚点名或数值 */
  value?: string | number;
}

export interface GuideTargetCondition {
  /** 条件组合逻辑：全部满足（and）或任一满足（or） */
  logic: "and" | "or";
  conditions: GuideCondition[];
}

/** v1 旧格式 {event, page} → 新表达式（数据迁移/读取兼容） */
export function normalizeTargetCondition(
  raw: GuideTargetCondition | null | undefined
): GuideTargetCondition | null {
  if (!raw) return null;
  // 新格式
  if (Array.isArray((raw as { conditions?: unknown }).conditions)) {
    return raw as GuideTargetCondition;
  }
  // 旧格式 {event, page}
  const legacy = raw as { event?: string; page?: string };
  const conditions: GuideCondition[] = [];
  if (legacy.event) {
    conditions.push({ field: "event_click", op: GuideConditionOp.EQ, value: legacy.event });
  }
  if (legacy.page) {
    conditions.push({ field: "page", op: GuideConditionOp.EQ, value: legacy.page });
  }
  return conditions.length > 0 ? { logic: "and", conditions } : null;
}

/** target_condition 结构校验（服务端 API 用） */
export function isValidTargetCondition(value: unknown): value is GuideTargetCondition {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.logic !== "and" && v.logic !== "or") return false;
  if (!Array.isArray(v.conditions) || v.conditions.length === 0) return false;
  return v.conditions.every((c) => {
    if (!c || typeof c !== "object") return false;
    const cond = c as Record<string, unknown>;
    if (typeof cond.field !== "string" || !cond.field) return false;
    // click_count 需带锚点名
    if (cond.field.startsWith("click_count.") && cond.field.length <= "click_count.".length) {
      return false;
    }
    if (cond.field === "click_count.") return false;
    if (typeof cond.op !== "string") return false;
    if (!Object.values(GuideConditionOp).includes(cond.op as GuideConditionOp)) return false;
    // 非 exists 条件需有 value
    if (
      cond.op !== GuideConditionOp.EXISTS &&
      (cond.value === undefined || cond.value === null || cond.value === "")
    ) {
      return false;
    }
    return true;
  });
}

/** 引导配置（guiders 表记录） */
export interface Guide {
  id: string;
  /** 唯一标识，带版本号（如 reveal_password_setup_v1） */
  guideKey: string;
  title: string;
  /** 适用路由（如 /settings） */
  page: string;
  steps: GuideStep[];
  status: GuideStatus;
  targetCondition: GuideTargetCondition | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/** 用户引导进度（user_guide_progress 表记录） */
export interface GuideProgress {
  id: string;
  userId: string;
  guideKey: string;
  status: GuideProgressStatus;
  /** in_progress 时记录当前步骤，下次续接 */
  currentStep: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}
