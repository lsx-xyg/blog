/**
 * 引导埋点注册表（Guide Event Anchor Registry）
 *
 * 统一维护已埋点的 data-guide 锚点，前端组件埋点与管理页下拉选项同源，
 * 避免前后端手写错标识（用户设计：元素定位 / 事件上报 / 条件配置用同一标识）。
 *
 * 使用：组件里 data-guide 值、派发 guide:trigger 的 detail.target、
 * 管理页 event_click 条件的 value 下拉，均取自这里。
 */

export interface GuideEventAnchor {
  /** data-guide 锚点值（也用作 event_click 条件的 value） */
  target: string;
  /** 展示名（管理页下拉用） */
  label: string;
  /** 锚点所在页面（后台相对路径前缀） */
  page: string;
}

/** 已埋点锚点列表（新增埋点先在此登记） */
export const GUIDE_EVENT_ANCHORS: GuideEventAnchor[] = [
  {
    target: "reveal-view",
    label: "敏感信息「查看」按钮（设置页）",
    page: "/settings",
  },
  {
    target: "account-set-password",
    label: "账号设置密码表单",
    page: "/account",
  },
];

/** 触发事件类型（guide:trigger 的 detail.event 固定值） */
export const GUIDE_TRIGGER_EVENT = "event_click";

export function getAnchorLabel(target: string): string {
  return (
    GUIDE_EVENT_ANCHORS.find((a) => a.target === target)?.label ?? target
  );
}
