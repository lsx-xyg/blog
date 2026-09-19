import type { GuideCondition, GuideStep } from "@/lib/types/guides";
import { GuideConditionOp, GuideStatus } from "@/lib/types/guides";
import type { FormState } from "./form-meta";

/**
 * 引导表单校验（纯函数，无 DOM/网络依赖，可单测）
 *
 * 规则集中在这里，管理页保存 / 发布 / 拾取前自动保存共用同一份校验：
 * - 必填：guideKey / title / page
 * - 发布需至少一个步骤
 * - 每个步骤：高亮元素（target 或 selector）/ 标题 / 说明必填，并组装为 GuideStep[]
 * - 触发条件：至少一条且每条通过 isConditionValid
 */

/** 条件行有效性（click_count 需有锚点；非 exists 需有 value） */
export function isConditionValid(c: GuideCondition): boolean {
  if (!c.field) return false;
  if (
    c.field.startsWith("click_count.") &&
    c.field.length <= "click_count.".length
  ) {
    return false;
  }
  if (c.field === "click_count.") return false;
  if (
    c.op !== GuideConditionOp.EXISTS &&
    (c.value === undefined || c.value === null || c.value === "")
  ) {
    return false;
  }
  return true;
}

export interface GuideFormValidation {
  ok: boolean;
  /** 校验失败原因（ok 时为空） */
  error: string | null;
  /** 校验通过时组装好的 GuideStep[] */
  steps?: GuideStep[];
}

export function validateGuideForm(form: FormState): GuideFormValidation {
  if (!form.guideKey.trim() || !form.title.trim() || !form.page.trim()) {
    return { ok: false, error: "请填写标题、guideKey、页面（必填项）" };
  }
  if (form.status === GuideStatus.PUBLISHED && form.steps.length === 0) {
    return {
      ok: false,
      error: "发布前至少需要一个步骤（可先保存草稿，再用拾取锚点补充）",
    };
  }
  // steps 校验（结构化表单 → GuideStep[]）
  const steps: GuideStep[] = [];
  for (const [i, s] of form.steps.entries()) {
    if (
      (!s.target.trim() && !s.selector?.trim()) ||
      !s.title.trim() ||
      !s.content.trim()
    ) {
      return {
        ok: false,
        error: `步骤 ${i + 1} 未填写完整：高亮元素（data-guide 或动态选择器）/ 标题 / 说明文字必填`,
      };
    }
    steps.push({
      id: s.id.trim() || `step_${i + 1}`,
      target: s.target.trim(),
      title: s.title.trim(),
      content: s.content.trim(),
      placement: (s.placement as GuideStep["placement"]) || "bottom",
      nextRoute: s.nextRoute.trim() || undefined,
      selector: s.selector?.trim() || undefined,
      selectorMeta: s.selectorMeta,
    });
  }
  if (form.conditions.length === 0 || !form.conditions.every(isConditionValid)) {
    return {
      ok: false,
      error:
        "触发条件至少一条，且 click_count 需填锚点名、非 exists 条件需填 value（event_click 可先留空，保存后拾取回填）",
    };
  }
  return { ok: true, error: null, steps };
}
