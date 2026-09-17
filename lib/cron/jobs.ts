/**
 * 定时任务分类/展示决策（纯函数，可独立单测）
 *
 * 职责：给定一个 cron-job.org 任务，回答它是系统任务还是普通任务（以及是否疑似孤儿系统任务），
 * 并提供稳定的展示辅助（系统标签取色、HTTP 方法名）。渲染层只消费分类结果，不再内联判断。
 *
 * 依赖方向：jobs.ts → system-jobs.ts / form.ts（单向，纯展示决策，无副作用）。
 */
import type { CronJob } from "@/lib/types/cron";
import {
  matchPresetByUrl,
  matchSystemJob,
  type SystemJobPreset,
} from "@/lib/cron/system-jobs";
import { REQUEST_METHODS } from "@/lib/cron/form";

/** 任务分类：system=命中系统预设（标题或 URL），orphan=疑似系统任务但匹配不到预设，custom=普通任务 */
export type JobKind = "system" | "orphan" | "custom";

export interface JobClassification {
  /** 标题命中预设（[blog:key] 规范） */
  preset: SystemJobPreset | null;
  /** 标题或 URL 命中预设（URL 命中时 preset 可能为 null，需重新「启动」修复标题） */
  urlPreset: SystemJobPreset | null;
  /** 标题/URL 命中系统特征但匹配不到任何预设（标题被改动等） */
  orphan: boolean;
  kind: JobKind;
}

/** 系统任务特征 URL 片段（孤儿判断用：URL 指向系统接口但标题已不符合规范） */
export const SYSTEM_ROUTE_FRAGMENTS = [
  "/api/cron/backup",
  "/api/cron/publish-scheduled",
];

/** 孤儿系统任务：标题/URL 命中系统特征但匹配不到预设（标题被改动等） */
export function isOrphanSystemJob(job: CronJob): boolean {
  return (
    !matchSystemJob(job) &&
    (job.title.includes("[系统") ||
      job.title.includes("[blog:") ||
      SYSTEM_ROUTE_FRAGMENTS.some((f) => job.url.includes(f)))
  );
}

/** 综合分类：渲染层唯一入口，替代内联的 preset/urlPreset/orphan 三段判断 */
export function classifyJob(job: CronJob): JobClassification {
  const preset = matchSystemJob(job);
  const urlPreset = preset ?? matchPresetByUrl(job);
  const orphan = !urlPreset && isOrphanSystemJob(job);
  return {
    preset,
    urlPreset,
    orphan,
    kind: urlPreset ? "system" : orphan ? "orphan" : "custom",
  };
}

/** 系统标签多色：按预设名 hash 稳定取色（同一预设恒定同色，不随渲染闪变） */
export const SYSTEM_TAG_COLORS = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "bg-pink-500/10 text-pink-600 dark:text-pink-400",
];

export function systemTagColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SYSTEM_TAG_COLORS[h % SYSTEM_TAG_COLORS.length];
}

/** HTTP 方法展示名（cron-job.org 的 requestMethod 数值 → 标签） */
export function methodLabel(method: number): string {
  return (
    REQUEST_METHODS.find((m) => m.value === method)?.label ||
    `UNKNOWN(${method})`
  );
}

/** 任务可执行动作（渲染按钮集合，顺序即展示顺序） */
export type CronAction =
  | "start"
  | "stop"
  | "run"
  | "toggle"
  | "edit"
  | "history"
  | "delete";

/**
 * 按任务分类给出可执行动作集合（系统任务：启停 + 可手动触发 + 编辑/历史/删除；
 * 普通任务：启用禁用 + 编辑/历史/删除）。桌面表格与移动卡片共用同一决策。
 */
export function availableActions(
  job: CronJob,
  c: JobClassification
): CronAction[] {
  if (c.urlPreset) {
    const actions: CronAction[] = [job.enabled ? "stop" : "start"];
    if (c.urlPreset.supportsRun) actions.push("run");
    actions.push("edit", "history", "delete");
    return actions;
  }
  return ["toggle", "edit", "history", "delete"];
}
