/**
 * 系统定时任务业务层
 *
 * 职责：站点业务规则——系统任务预设的创建/查找/状态聚合。
 * 与 client.ts（HTTP 适配器）分离：业务规则可独立测试，HTTP 细节不渗透上层。
 *
 * 依赖方向：service.ts → client.ts / system-jobs.ts（单向）
 */
import type { CronJob } from "@/lib/types/cron";
import { SYSTEM_JOB_PRESETS, getSystemJobPreset } from "@/lib/cron/system-jobs";
import { createCronJob, listCronJobs } from "@/lib/cron/client";

/**
 * 创建系统定时任务（按预设创建）
 *
 * @param presetKey 预设键（SYSTEM_JOB_PRESETS）
 * @param ctx { siteUrl, cronSecret } 预设所需的站点上下文
 * @returns 任务 ID
 */
export async function createSystemJob(
  presetKey: string,
  ctx: { siteUrl: string; cronSecret: string },
): Promise<number> {
  const preset = getSystemJobPreset(presetKey);
  if (!preset) {
    throw new Error(`未知的系统定时任务预设: ${presetKey}`);
  }
  return createCronJob(preset.createConfig(ctx));
}

/** 兼容入口：创建定时发布扫描任务（旧调用方） */
export async function createGlobalPublishJob(
  siteUrl: string,
  cronSecret: string,
): Promise<number> {
  return createSystemJob("publish_scheduled", { siteUrl, cronSecret });
}

/**
 * 查找系统任务对应的 cron-job.org 任务
 * @param presetKey 预设键；缺省取第一个预设（兼容旧的全局发布查找）
 * @returns 任务详情，如果不存在返回 null
 */
export async function findSystemJob(
  presetKey?: string,
): Promise<CronJob | null> {
  const jobs = await listCronJobs();
  if (presetKey) {
    const preset = getSystemJobPreset(presetKey);
    if (!preset) return null;
    // 优先按标题中的 [系统:key] 精确匹配（唯一对应），旧标题按名称兜底
    return (
      jobs.find((j) => j.title.includes(`[系统:${presetKey}]`)) ||
      jobs.find((j) => j.title.includes(preset.name)) ||
      null
    );
  }
  return (
    jobs.find((j) => j.title.includes("[系统:publish_scheduled]")) ||
    jobs.find((j) => j.title.includes("定时发布扫描")) ||
    null
  );
}

/** 兼容入口：查找定时发布扫描任务 */
export async function findGlobalPublishJob(): Promise<CronJob | null> {
  return findSystemJob("publish_scheduled");
}

/** 列出所有系统任务（含状态），供总览一次查询 */
export async function listSystemJobsStatus(): Promise<
  Array<{
    key: string;
    name: string;
    description: string;
    supportsRun: boolean;
    enabled: boolean;
    jobId?: number;
    nextRun?: number | null;
  }>
> {
  const jobs = await listCronJobs();
  return SYSTEM_JOB_PRESETS.map((preset) => {
    const job =
      jobs.find((j) => j.title.includes(`[系统:${preset.key}]`)) ||
      jobs.find((j) => j.title.includes(preset.name)) ||
      null;
    return {
      key: preset.key,
      name: preset.name,
      description: preset.description,
      supportsRun: !!preset.supportsRun,
      enabled: job?.enabled ?? false,
      jobId: job?.jobId,
      nextRun: job?.nextExecution ?? null,
    };
  });
}
