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

const CRON_JOB_API_BASE = "https://api.cron-job.org";

/** cron-job.org 定时任务配置 */
export type CronJobConfig = {
  /** 任务名称 */
  title: string;
  /** cron 表达式（5位：分 时 日 月 周） */
  schedule: {
    md?: number; // 分钟（0-59），不填表示每分钟
    h?: number; // 小时（0-23），不填表示每小时
    dom?: number; // 日（1-31），不填表示每天
    mon?: number; // 月（1-12），不填表示每月
    dow?: number; // 周几（0-6，0=周日），不填表示每周
  };
  /** 请求 URL */
  url: string;
  /** 请求方法（GET/POST/PUT/DELETE/PATCH） */
  requestMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体（POST/PUT/PATCH 时使用） */
  body?: string;
  /** 超时时间（秒，默认 30） */
  timeout?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 保存响应体（默认 false） */
  saveResponses?: boolean;
};

/** cron-job.org 定时任务详情 */
export type CronJob = {
  jobId: number;
  title: string;
  schedule: CronJobConfig["schedule"];
  url: string;
  requestMethod: string;
  enabled: boolean;
  lastStatus: number;
  lastDuration: number;
  nextRun: number;
  createdAt: number;
};

/** 获取 API Key */
function getApiKey(): string | null {
  return process.env.CRON_JOB_API_KEY || null;
}

/** 发起 API 请求 */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("CRON_JOB_API_KEY 未配置");
  }

  const res = await fetch(`${CRON_JOB_API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`cron-job.org API 请求失败: ${res.status} ${res.statusText} ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * 创建定时任务
 * @param config 定时任务配置
 * @returns 任务 ID
 */
export async function createCronJob(config: CronJobConfig): Promise<number> {
  const result = await apiRequest<{ jobId: number }>("POST", "/jobs", {
    job: {
      title: config.title,
      schedule: config.schedule,
      url: config.url,
      requestMethod: config.requestMethod || "GET",
      headers: config.headers,
      body: config.body,
      timeout: config.timeout || 30,
      enabled: config.enabled ?? true,
      saveResponses: config.saveResponses ?? false,
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
 * @returns 定时任务列表
 */
export async function listCronJobs(): Promise<CronJob[]> {
  const result = await apiRequest<{ jobs: CronJob[] }>("GET", "/jobs");
  return result.jobs;
}

/**
 * 获取单个定时任务详情
 * @param jobId 任务 ID
 * @returns 定时任务详情
 */
export async function getCronJob(jobId: number): Promise<CronJob> {
  return apiRequest<CronJob>("GET", `/jobs/${jobId}`);
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
    schedule: {}, // 空对象表示每分钟执行一次
    url: `${siteUrl}/api/cron/publish-scheduled?secret=${encodeURIComponent(cronSecret)}`,
    requestMethod: "GET",
    timeout: 30,
    enabled: true,
    saveResponses: false,
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
