/**
 * T12 定时任务：cron-job.org API 集成
 *
 * 文档：https://docs.cron-job.org/rest-api.html
 *
 * 功能：
 * - createJob：创建定时任务
 * - deleteJob：删除定时任务
 * - listJobs：列出所有定时任务
 * - getJob：获取单个定时任务详情
 *
 * 鉴权：API Key（请求头 Authorization: Bearer <API_KEY>）
 * - 环境变量：CRON_JOB_API_KEY
 * - 获取地址：https://cron-job.org/en/members/settings/
 *
 * 注意：cron-job.org 的定时任务是循环执行的（基于 cron 表达式）
 * 我们采用方案 A：创建一个每分钟执行一次的全局定时任务，扫描所有到期的定时文章并发布
 * 不需要为每篇文章创建/删除定时任务（更简单可靠）
 */

import { getCronJobApiKey } from "@/lib/settings";
import {
  CronJobConfig,
  RequestMethod,
  CronJob,
  CronJobDetailed,
  CronJobHistoryItem,
  CronJobExecutionDetail,
} from "@/lib/types/cron";
import { SYSTEM_JOB_PRESETS, getSystemJobPreset } from "@/lib/cron/system-jobs";

const CRON_JOB_API_BASE = "https://api.cron-job.org";

/** 发起 API 请求 */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey = await getCronJobApiKey();
  if (!apiKey) {
    throw new Error("CRON_JOB_API_KEY 未配置");
  }

  const res = await fetch(`${CRON_JOB_API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`cron-job.org API 请求失败: ${res.status} ${res.statusText} ${text}`);
  }

  // DELETE / PATCH 返回 {}，GET /jobs 返回带字段的对象
  return res.json() as Promise<T>;
}

/**
 * 创建定时任务
 * @param config 任务配置（url 必填）
 * @returns 任务 ID
 */
export async function createCronJob(config: CronJobConfig): Promise<number> {
  const result = await apiRequest<{ jobId: number }>("PUT", "/jobs", {
    job: {
      title: config.title ?? "",
      url: config.url,
      enabled: config.enabled ?? false,
      saveResponses: config.saveResponses ?? false,
      schedule: config.schedule ?? {},
      requestMethod: config.requestMethod ?? RequestMethod.GET,
      extendedData: config.extendedData,
      requestTimeout: config.requestTimeout ?? -1,
      redirectSuccess: config.redirectSuccess ?? false,
      auth: config.auth,
      notification: config.notification,
    },
  });
  return result.jobId;
}

/**
 * 删除定时任务
 * @param jobId 任务 ID
 */
export async function deleteCronJob(jobId: number): Promise<void> {
  await apiRequest("DELETE", `/jobs/${jobId}`);
}

/**
 * 列出所有定时任务
 */
export async function listCronJobs(): Promise<CronJob[]> {
  const result = await apiRequest<{ jobs: CronJob[]; someFailed: boolean }>(
    "GET",
    "/jobs",
  );
  return result.jobs;
}

/**
 * 获取单个定时任务详情
 * @param jobId 任务 ID
 */
export async function getCronJob(jobId: number): Promise<CronJobDetailed> {
  const result = await apiRequest<{ jobDetails: CronJobDetailed }>(
    "GET",
    `/jobs/${jobId}`,
  );
  return result.jobDetails;
}

/**
 * 更新定时任务（只传要改的字段）
 * @param jobId 任务 ID
 * @param delta 要修改的字段
 */
export async function updateCronJob(
  jobId: number,
  delta: Partial<CronJobConfig>,
): Promise<void> {
  await apiRequest("PATCH", `/jobs/${jobId}`, { job: delta });
}

/**
 * 获取任务执行历史列表
 * @param jobId 任务 ID
 */
export async function getJobHistory(jobId: number): Promise<CronJobHistoryItem[]> {
  const result = await apiRequest<{ history: CronJobHistoryItem[] }>(
    "GET",
    `/jobs/${jobId}/history`,
  );
  return result.history || [];
}

/**
 * 获取单次执行详情（含响应头、响应体、性能统计）
 * @param jobId 任务 ID
 * @param identifier 执行标识符（history 列表项的 id）
 */
export async function getJobHistoryDetail(
  jobId: number,
  identifier: string,
): Promise<CronJobExecutionDetail> {
  const result = await apiRequest<{ jobHistoryDetails: CronJobExecutionDetail }>(
    "GET",
    `/jobs/${jobId}/history/${identifier}`,
  );
  return result.jobHistoryDetails;
}

/**
 * 创建系统定时任务（方案 A：按预设创建）
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
    return jobs.find((j) => j.title.includes(preset.name)) || null;
  }
  return jobs.find((j) => j.title.includes("定时发布扫描")) || null;
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
    const job = jobs.find((j) => j.title.includes(preset.name)) || null;
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
