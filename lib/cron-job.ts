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

/** RequestMethod 枚举（官方文档） */
export const RequestMethod = {
  GET: 0,
  POST: 1,
  OPTIONS: 2,
  HEAD: 3,
  PUT: 4,
  DELETE: 5,
  TRACE: 6,
  CONNECT: 7,
  PATCH: 8,
} as const;

export type RequestMethod = (typeof RequestMethod)[keyof typeof RequestMethod];

/** JobSchedule（官方文档） */
export type CronJobSchedule = {
  /** 时区，如 "Asia/Shanghai"，默认 UTC */
  timezone?: string;
  /** 过期时间（YYYYMMDDhhmmss，0 = 不过期） */
  expiresAt?: number;
  /** 小时（0-23，[-1] = 每小时） */
  hours?: number[];
  /** 日（1-31，[-1] = 每天） */
  mdays?: number[];
  /** 分钟（0-59，[-1] = 每分钟） */
  minutes?: number[];
  /** 月（1-12，[-1] = 每月） */
  months?: number[];
  /** 周几（0=周日 - 6=周六，[-1] = 每天） */
  wdays?: number[];
};

/** JobExtendedData（官方文档） */
export type CronJobExtendedData = {
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: string;
};

/** Job（官方文档） */
export type CronJob = {
  jobId: number;
  enabled: boolean;
  title: string;
  saveResponses: boolean;
  url: string;
  lastStatus: number;
  lastDuration: number;
  lastExecution: number;
  sslCertExpiry?: number;
  /** 预测的下次执行时间（Unix 秒），无预测时为 null */
  nextExecution: number | null;
  type: number;
  requestTimeout: number;
  redirectSuccess: boolean;
  folderId: number;
  schedule: CronJobSchedule;
  requestMethod: RequestMethod;
};

/** DetailedJob（官方文档） */
export type CronJobDetailed = CronJob & {
  auth?: {
    enable: boolean;
    user: string;
    password: string;
  };
  notification?: {
    onFailure: boolean;
    onFailureCount: number;
    onSuccess: boolean;
    onDisable: boolean;
    onSslCertExpiry: boolean;
    onSslCertExpirySeconds: number;
  };
  extendedData?: CronJobExtendedData;
};

/** 创建任务时的输入（只有 url 是必填） */
export type CronJobConfig = {
  /** 任务名称 */
  title?: string;
  /** 请求 URL（必填） */
  url: string;
  /** 是否启用，默认 false */
  enabled?: boolean;
  /** 是否保存响应体，默认 false */
  saveResponses?: boolean;
  /** 调度配置，默认 UTC + 空数组 */
  schedule?: CronJobSchedule;
  /** 请求方法，默认 GET（0） */
  requestMethod?: RequestMethod;
  /** 请求头/请求体 */
  extendedData?: CronJobExtendedData;
  /** 超时时间（秒），默认 -1（用平台默认） */
  requestTimeout?: number;
  /** 是否将 3xx 视为成功，默认 false */
  redirectSuccess?: boolean;
  /** 所在文件夹 ID，默认 0（根目录） */
  folderId?: number;
};

/** 获取 API Key（支持环境变量和 DB 动态配置） */
async function getApiKey(): Promise<string | null> {
  // 优先使用环境变量
  if (process.env.CRON_JOB_API_KEY) {
    return process.env.CRON_JOB_API_KEY;
  }
  // 动态导入避免循环依赖
  const { getCronConfig } = await import("@/lib/settings");
  const { cronJobApiKey } = await getCronConfig();
  return cronJobApiKey || null;
}

/** 发起 API 请求 */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey = await getApiKey();
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
