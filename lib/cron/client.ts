/**
 * cron-job.org API 客户端（适配器层）
 *
 * 职责：HTTP 传输 + 鉴权 + 官方接口的 1:1 转发。不包含任何站点业务规则。
 * 文档：https://docs.cron-job.org/rest-api.html
 *
 * 鉴权：API Key（请求头 Authorization: Bearer <API_KEY>）
 * - 来源：settings 表 cron.job_api_key（AES-256-GCM 加密）
 * - 获取地址：https://cron-job.org/en/members/settings/
 *
 * 依赖方向：client.ts ← service.ts（业务层调适配器，方向单向）
 */
import { getCronJobApiKey } from "@/lib/settings";
import type {
  CronJobConfig,
  CronJob,
  CronJobDetailed,
  CronJobHistoryItem,
  CronJobExecutionDetail,
} from "@/lib/types/cron";
import { RequestMethod } from "@/lib/types/cron";

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
 * @param identifier 执行标识符（history 列表项的 identifier 字段）
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
