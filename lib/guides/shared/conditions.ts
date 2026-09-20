/**
 * 引导触发条件评估（前后端共用纯函数）
 *
 * target_condition 通用表达式：{logic:"and"|"or", conditions: GuideCondition[]}
 * 字段约定见 lib/types/guides.ts 与 lib/guide-events.ts。
 */

import type { GuideCondition, GuideTargetCondition } from '@/lib/types/guides';
import { GuideConditionOp } from '@/lib/types/guides';

/** 条件评估上下文（触发事件 + 服务端统计） */
export interface GuideConditionContext {
  /** 触发事件类型（固定 event_click） */
  event?: string;
  /** 锚点值（data-guide） */
  target?: string;
  /** 当前页面路径（如 /settings） */
  page?: string;
  /** click_count.<target> 的累计次数 */
  clickCounts?: Record<string, number>;
  /** 用户注册天数 */
  userAgeDays?: number;
}

/** 页面前缀匹配：配置值 /settings 匹配实际页面 /settings 及 /settings/xxx */
export function pagePrefixMatch(page: string | undefined, value: string | number): boolean {
  if (typeof page !== 'string') return false;
  const v = String(value);
  return page === v || page.startsWith(v.endsWith('/') ? v : `${v}/`) || page.startsWith(v);
}

/** 单条条件评估 */
export function evaluateCondition(cond: GuideCondition, ctx: GuideConditionContext): boolean {
  const { field, op } = cond;

  // event_click：用户点击了某锚点元素（实时行为触发）
  if (field === 'event_click') {
    const hit = ctx.event === 'event_click' && ctx.target === String(cond.value ?? '');
    if (op === GuideConditionOp.EQ) return hit;
    if (op === GuideConditionOp.EXISTS) return hit;
    return false;
  }

  // page：适用页面前缀
  if (field === 'page') {
    if (op === GuideConditionOp.EQ) return pagePrefixMatch(ctx.page, cond.value ?? '');
    if (op === GuideConditionOp.EXISTS) return typeof ctx.page === 'string' && ctx.page.length > 0;
    return false;
  }

  // click_count.<target>：服务端 user_events 统计
  if (field.startsWith('click_count.')) {
    const anchor = field.slice('click_count.'.length);
    const count = ctx.clickCounts?.[anchor] ?? 0;
    const v = Number(cond.value ?? 1);
    switch (op) {
      case GuideConditionOp.EQ:
        return count === v;
      case GuideConditionOp.GTE:
        return count >= v;
      case GuideConditionOp.LTE:
        return count <= v;
      case GuideConditionOp.EXISTS:
        return count > 0;
      default:
        return false;
    }
  }

  // user_age_days：用户注册天数
  if (field === 'user_age_days') {
    const days = ctx.userAgeDays ?? -1;
    const v = Number(cond.value ?? 0);
    switch (op) {
      case GuideConditionOp.EQ:
        return days === v;
      case GuideConditionOp.GTE:
        return days >= v;
      case GuideConditionOp.LTE:
        return days <= v;
      case GuideConditionOp.EXISTS:
        return days >= 0;
      default:
        return false;
    }
  }

  return false;
}

/** 整组条件评估（logic: and=全部满足 / or=任一满足） */
export function evaluateTargetCondition(
  tc: GuideTargetCondition | null | undefined,
  ctx: GuideConditionContext,
): boolean {
  if (!tc || !Array.isArray(tc.conditions) || tc.conditions.length === 0) {
    return true;
  }
  const results = tc.conditions.map((c) => evaluateCondition(c, ctx));
  return tc.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

/** 是否需要服务端统计数据（click_count / user_age_days）才能评估 */
export function needsServerData(tc: GuideTargetCondition | null | undefined): boolean {
  if (!tc || !Array.isArray(tc.conditions)) return false;
  return tc.conditions.some(
    (c) => c.field.startsWith('click_count.') || c.field === 'user_age_days',
  );
}
