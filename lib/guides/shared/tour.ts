/**
 * Guide 展示层映射（纯函数，可独立单测）
 *
 * 职责：把 DB 里的 GuideStep[] 映射为 onborda 的 Step[]（展示模型）——
 * 选择器解析（data-guide → 动态选择器多级定位）、placement→side、nextRoute 拼接、
 * 命中检测与失效上报分发。DOM 查询通过 isHit 注入，函数本身不触碰 document。
 *
 * 依赖方向：tour.ts → trigger.ts（resolveStepSelectors）/ types（单向）。
 */
import type { Guide, GuideStep } from "@/lib/types/guides";
import { resolveStepSelectors } from "./trigger";

export interface BuildTourOptions {
  /** 选择器命中检测（默认 document.querySelector，测试注入 fake） */
  isHit?: (selector: string) => boolean;
  /** 候选选择器存在但未命中时回调（失效监控上报用） */
  onMiss?: (step: GuideStep) => void;
}

/**
 * 取第一个当前 DOM 命中的选择器；都不命中返回第一个（交给 onborda 兜底显示）。
 * 非法选择器（isHit 抛异常）跳过。
 */
export function pickSelector(
  selectors: string[],
  isHit: (selector: string) => boolean
): string {
  if (selectors.length === 0) return "";
  for (const sel of selectors) {
    try {
      if (isHit(sel)) return sel;
    } catch {
      /* 非法选择器跳过 */
    }
  }
  return selectors[0];
}

/** 安全命中检测：默认实现（document.querySelector + 非法选择器兜底） */
export function defaultIsHit(selector: string): boolean {
  try {
    return !!document.querySelector(selector);
  } catch {
    return false;
  }
}

/**
 * DB 步骤 → onborda Step 数组。
 * - selector：resolveStepSelectors 多级定位（data-guide 优先 + 动态选择器兜底）
 * - side：placement 默认 bottom
 * - nextRoute：`/${adminPath}${nextRoute}` 拼接（如 adminPath=dashboard → /dashboard/settings）
 */
export function buildTourSteps(
  guide: Guide,
  adminPath: string,
  opts?: BuildTourOptions
) {
  const isHit = opts?.isHit ?? defaultIsHit;
  const onMiss = opts?.onMiss;
  return guide.steps.map((s) => {
    const selector = pickSelector(resolveStepSelectors(s), isHit);
    if (selector && !isHit(selector)) onMiss?.(s);
    return {
      icon: null,
      title: s.title,
      content: s.content,
      selector,
      side: s.placement ?? "bottom",
      showControls: false,
      nextRoute: s.nextRoute ? `/${adminPath}${s.nextRoute}` : undefined,
    };
  });
}
