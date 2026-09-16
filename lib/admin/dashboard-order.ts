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

/** 归一化：过滤未知 key + 去重 + 补全缺失默认 key（顺序稳定） */
export function normalizeCardOrder(order: unknown): string[] {
  const input = Array.isArray(order) ? (order as unknown[]) : [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of input) {
    if (
      typeof item === "string" &&
      (DASHBOARD_CARD_KEYS as readonly string[]).includes(item) &&
      !seen.has(item)
    ) {
      seen.add(item);
      normalized.push(item);
    }
  }
  for (const key of DEFAULT_DASHBOARD_ORDER) {
    if (!seen.has(key)) {
      normalized.push(key);
    }
  }
  return normalized;
}
