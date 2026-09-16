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
  CronFolder,
} from "@/lib/types/cron";

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
      folderId: config.folderId ?? 0,
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
  identifier: number,
): Promise<CronJobExecutionDetail> {
  const result = await apiRequest<{ executionDetails: CronJobExecutionDetail }>(
    "GET",
    `/jobs/${jobId}/history/${identifier}`,
  );
  return result.executionDetails;
}

/**
 * 列出所有文件夹
 */
export async function listCronFolders(): Promise<CronFolder[]> {
  const result = await apiRequest<{ folders: CronFolder[] }>("GET", "/folders");
  return result.folders || [];
}

/**
 * 创建文件夹
 * @param name 文件夹名称
 * @returns 文件夹 ID
 */
export async function createCronFolder(name: string): Promise<number> {
  const result = await apiRequest<{ folderId: number }>("PUT", "/folders", {
    name,
    enabled: true,
  });
  return result.folderId;
}

/**
 * 更新文件夹（重命名 / 启用禁用）
 */
export async function updateCronFolder(
  folderId: number,
  delta: { name?: string; enabled?: boolean },
): Promise<void> {
  await apiRequest("PATCH", `/folders/${folderId}`, delta);
}

/**
 * 删除文件夹（文件夹内任务将移到根目录）
 */
export async function deleteCronFolder(folderId: number): Promise<void> {
  await apiRequest("DELETE", `/folders/${folderId}`);
}

/**
 * 创建全局定时发布任务（方案 A：每分钟扫描一次）
 *
 * @param siteUrl 站点 URL（如 https://blog.example.com）
 * @param cronSecret CRON_SECRET（用于接口鉴权）
 * @returns 任务 ID
 */
export async function createGlobalPublishJob(
  siteUrl: string,
  cronSecret: string,
): Promise<number> {
  return createCronJob({
    title: "博客定时发布扫描（每分钟）",
    url: `${siteUrl}/api/cron/publish-scheduled`,
    enabled: true,
    saveResponses: false,
    requestMethod: RequestMethod.GET,
    requestTimeout: 30,
    extendedData: {
      headers: {
        "X-Cron-Secret": cronSecret,   // ← secret 放 header
      },
    },
    schedule: {
      timezone: "Asia/Shanghai",
      expiresAt: 0,
      hours: [-1],
      mdays: [-1],
      minutes: [-1], // 每分钟
      months: [-1],
      wdays: [-1],
    },
  });
}

/**
 * 查找全局定时发布任务
 * @returns 任务详情，如果不存在返回 null
 */
export async function findGlobalPublishJob(): Promise<CronJob | null> {
  const jobs = await listCronJobs();
  return jobs.find((j) => j.title.includes("定时发布扫描")) || null;
}
