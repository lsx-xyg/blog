/**
 * 引导拾取跳转 URL 构造（server-safe，纯函数）
 *
 * 跳转到「引导适用页面」并携带拾取参数：
 * - page 为空 → 返回 null（调用方应禁用按钮并提示先选择页面）
 * - 正常 → /<adminPath><page>?guide-pick=1&guide_id=...&...
 */
export interface PickParams {
  guideId: string;
  /** 步骤拾取：step_id；触发条件拾取：cond_idx（二者选一） */
  stepId?: string;
  conditionIndex?: number;
}

export function buildGuidePickUrl(
  adminPath: string,
  page: string,
  params: PickParams,
): string | null {
  const pagePath = page.trim();
  if (!pagePath) return null; // 未选择页面 → 不生成跳转链接

  const base = `/${adminPath.replace(/^\/+|\/+$/g, '')}${
    pagePath.startsWith('/') ? pagePath : `/${pagePath}`
  }`;

  const query = new URLSearchParams({
    'guide-pick': '1',
    guide_id: params.guideId,
  });
  if (params.stepId !== undefined) query.set('step_id', params.stepId);
  if (params.conditionIndex !== undefined) {
    query.set('cond_idx', String(params.conditionIndex));
  }
  return `${base}?${query.toString()}`;
}
