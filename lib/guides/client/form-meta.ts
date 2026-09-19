import type {
  GuideCondition,
  GuideStep,
} from "@/lib/types/guides";
import { GuideConditionOp, GuideStatus } from "@/lib/types/guides";
import { GUIDE_EVENT_ANCHORS } from "../shared/anchor-registry";

/**w
 * 引导表单元数据（纯数据：类型 + 常量 + 默认值）
 *
 * 供管理页表单（manage-guides）、条件编辑器、步骤编辑器共享，
 * 与渲染解耦，可直接被校验逻辑复用。
 */

/** 表单样式类（与后台管理页统一） */
export const inputClass =
  "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all";
export const labelClass = "block text-sm font-medium text-foreground";
export const helpClass = "mt-1 text-xs text-muted-foreground leading-relaxed";

/** 条件字段下拉选项 */
export const FIELD_OPTIONS = [
  { value: "event_click", label: "event_click（用户点击了元素）" },
  { value: "page", label: "page（适用页面）" },
  { value: "click_count", label: "click_count.（点击次数）" },
  { value: "user_age_days", label: "user_age_days（注册天数）" },
];

export const FIELD_HELP: Record<string, string> = {
  event_click:
    "用户点击了某个元素就触发。value 选「点击的锚点」（即该元素上的 data-guide 标记，与前端埋点用同一标识）。",
  page: "只在指定后台页面触发。value 从下方下拉选择（选项由系统路由自动生成）。",
  click_count:
    "点击累计次数达到才触发（需先在用户行为表有点击记录）。在中间框填锚点名，右边填次数。",
  user_age_days: "账号注册满多少天才触发。value 填天数（如 3 = 注册满 3 天）。",
};

export const OP_LABEL: Record<GuideConditionOp, string> = {
  eq: "等于 (eq)",
  gte: "大于等于 (gte)",
  lte: "小于等于 (lte)",
  exists: "存在 (exists)",
};

/** 不同字段允许的操作符（页面/点击事件只有「等于」；数字字段支持比较） */
export const OP_BY_FIELD: Record<string, GuideConditionOp[]> = {
  event_click: [GuideConditionOp.EQ],
  page: [GuideConditionOp.EQ],
  user_age_days: [GuideConditionOp.EQ, GuideConditionOp.GTE, GuideConditionOp.LTE],
  click_count: [GuideConditionOp.EQ, GuideConditionOp.GTE, GuideConditionOp.LTE],
};

/** 切换字段时的默认值（数据隔离：切字段不沿用上一字段的值） */
export const DEFAULT_VALUE_BY_FIELD: Record<string, string | number> = {
  event_click: "",
  page: "",
  user_age_days: 3,
  click_count: 1,
};

export const PLACEMENT_OPTIONS = [
  { value: "bottom", label: "下方" },
  { value: "top", label: "上方" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
];

/** 步骤表单（编辑时使用，保存时映射为 GuideStep[]） */
export interface StepForm {
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

export const emptyStepForm = (): StepForm => ({
  id: "step_1",
  target: "",
  title: "",
  content: "",
  placement: "bottom",
  nextRoute: "",
});

/** GuideStep[] → StepForm[]（兼容手写 JSON 缺字段） */
export const toStepForms = (steps: GuideStep[]): StepForm[] =>
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

/** 引导表单状态（新建/编辑共用） */
export interface FormState {
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

export const EMPTY_FORM: FormState = {
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
