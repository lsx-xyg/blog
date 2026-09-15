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

/** 引导步骤（steps JSONB 中的单个元素） */
export interface GuideStep {
  id: string;
  /** data-guide 锚点名，前端用 [data-guide="<target>"] 定位 */
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** 下一步跳转路由（相对后台路径，如 /account），onborda 跨页步骤使用 */
  nextRoute?: string;
}

/** 触发条件（target_condition JSONB），行为 + 页面组合 */
export interface GuideTargetCondition {
  /** 触发事件名（如 reveal-click），由前端 GuideManager 派发 */
  event?: string;
  /** 页面路径前缀（如 /settings），匹配则触发 */
  page?: string;
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
