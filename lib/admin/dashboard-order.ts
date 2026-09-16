/**
 * 管理首页统计卡片顺序：默认顺序 + 归一化（服务端与 API 共用）
 */
export const DASHBOARD_CARD_KEYS = [
  "totalPosts",
  "publishedPosts",
  "draftPosts",
  "scheduledPosts",
  "totalViews",
  "totalTags",
  "totalMedia",
  "totalFriendLinks",
] as const;

/** 默认顺序：未自定义时使用 */
export const DEFAULT_DASHBOARD_ORDER = [...DASHBOARD_CARD_KEYS];

export const DASHBOARD_ORDER_KEY = "admin_dashboard_card_order";

/** 通用归一化：按白名单过滤未知 key + 去重 + 补全缺失默认 key（顺序稳定） */
export function normalizeOrder(
  order: unknown,
  keys: readonly string[],
): string[] {
  const input = Array.isArray(order) ? (order as unknown[]) : [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of input) {
    if (
      typeof item === "string" &&
      (keys as readonly string[]).includes(item) &&
      !seen.has(item)
    ) {
      seen.add(item);
      normalized.push(item);
    }
  }
  for (const key of keys) {
    if (!seen.has(key)) {
      normalized.push(key);
    }
  }
  return normalized;
}

/** 归一化统计卡片顺序（向后兼容） */
export function normalizeCardOrder(order: unknown): string[] {
  return normalizeOrder(order, DEFAULT_DASHBOARD_ORDER);
}

/* ---------- 快捷入口顺序 ---------- */

export const QUICK_LINK_KEYS = [
  "posts",
  "media",
  "tags",
  "friendLinks",
  "settings",
  "cron",
  "backup",
  "account",
  "guides",
] as const;

/** 快捷入口默认顺序 */
export const DEFAULT_QUICK_ORDER = [...QUICK_LINK_KEYS];

export const QUICK_ORDER_KEY = "admin_dashboard_quick_order";

/** 归一化快捷入口顺序 */
export function normalizeQuickOrder(order: unknown): string[] {
  return normalizeOrder(order, DEFAULT_QUICK_ORDER);
}
