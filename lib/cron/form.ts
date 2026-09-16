/**
 * 定时任务表单模块（纯逻辑，零 React / 零副作用）
 *
 * 表单视图模型（FormState）与 API 域模型（CronJob / CronJobConfig）之间的转换，
 * 以及表单相关的常量与调度数组解析。从 manage-cron-jobs.tsx 抽出，
 * 使表单规则可独立单测。
 *
 * 依赖方向：form.ts → lib/types/cron.ts（单向，只读类型）
 */
import { RequestMethod } from "@/lib/types/cron";
import type { CronJob, CronJobConfig } from "@/lib/types/cron";

/** 任务表单视图模型（字符串化调度、KV 头数组，与 API 域模型形态不同） */
export type FormState = {
  title: string;
  url: string;
  enabled: boolean;
  saveResponses: boolean;
  requestMethod: number;
  requestTimeout: number;
  redirectSuccess: boolean;
  headers: Array<{ key: string; value: string }>;
  body: string;
  schedule: {
    timezone: string;
    minutes: string;
    hours: string;
    mdays: string;
    months: string;
    wdays: string;
  };
  auth: {
    enable: boolean;
    user: string;
    password: string;
  };
  notification: {
    onFailure: boolean;
    onFailureCount: number;
    onSuccess: boolean;
    onDisable: boolean;
    onSslCertExpiry: boolean;
    onSslCertExpirySeconds: number;
  };
};

/** 新建任务的默认表单值 */
export const DEFAULT_FORM: FormState = {
  title: "",
  url: "",
  enabled: true,
  saveResponses: false,
  requestMethod: RequestMethod.GET,
  requestTimeout: -1,
  redirectSuccess: false,
  headers: [],
  body: "",
  schedule: {
    timezone: "Asia/Shanghai",
    minutes: "-1",
    hours: "-1",
    mdays: "-1",
    months: "-1",
    wdays: "-1",
  },
  auth: {
    enable: false,
    user: "",
    password: "",
  },
  notification: {
    onFailure: false,
    onFailureCount: 1,
    onSuccess: false,
    onDisable: false,
    onSslCertExpiry: false,
    onSslCertExpirySeconds: 604800,
  },
};

/** HTTP 方法下拉选项（值 = RequestMethod 枚举） */
export const REQUEST_METHODS = [
  { value: RequestMethod.GET, label: "GET" },
  { value: RequestMethod.POST, label: "POST" },
  { value: RequestMethod.PUT, label: "PUT" },
  { value: RequestMethod.DELETE, label: "DELETE" },
  { value: RequestMethod.PATCH, label: "PATCH" },
  { value: RequestMethod.HEAD, label: "HEAD" },
  { value: RequestMethod.OPTIONS, label: "OPTIONS" },
];

/** 时区下拉选项 */
export const TIMEZONES = [
  "Asia/Shanghai",
  "UTC",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

/** 表单调度字符串 → 数字数组（空串 / "-1" → [-1]，非法数字过滤） */
export function parseScheduleArray(value: string): number[] {
  if (value.trim() === "" || value.trim() === "-1") return [-1];
  return value
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !isNaN(v));
}

/** 数字数组 → 表单调度字符串（空/undefined → "-1"，单 -1 → "-1"） */
export function formatScheduleArray(arr: number[] | undefined): string {
  if (!arr || arr.length === 0) return "-1";
  if (arr.length === 1 && arr[0] === -1) return "-1";
  return arr.join(", ");
}

/** API 域模型 → 表单视图模型（列表接口不返回 extendedData，headers/body 留空待详情回填） */
export function jobToForm(job: CronJob): FormState {
  return {
    title: job.title || "",
    url: job.url,
    enabled: job.enabled,
    saveResponses: job.saveResponses,
    requestMethod: job.requestMethod,
    requestTimeout: job.requestTimeout,
    redirectSuccess: job.redirectSuccess,
    headers: [], // 列表接口不返回 extendedData，编辑时需要单独获取
    body: "",
    schedule: {
      timezone: job.schedule?.timezone || "Asia/Shanghai",
      minutes: formatScheduleArray(job.schedule?.minutes),
      hours: formatScheduleArray(job.schedule?.hours),
      mdays: formatScheduleArray(job.schedule?.mdays),
      months: formatScheduleArray(job.schedule?.months),
      wdays: formatScheduleArray(job.schedule?.wdays),
    },
    auth: {
      enable: false,
      user: "",
      password: "",
    },
    notification: {
      onFailure: false,
      onFailureCount: 1,
      onSuccess: false,
      onDisable: false,
      onSslCertExpiry: false,
      onSslCertExpirySeconds: 604800,
    },
  };
}

/** 表单视图模型 → API 域模型（调度数组解析、可选 extendedData/auth/notification） */
export function formToConfig(form: FormState): CronJobConfig {
  const config: CronJobConfig = {
    title: form.title,
    url: form.url,
    enabled: form.enabled,
    saveResponses: form.saveResponses,
    requestMethod: form.requestMethod as CronJobConfig["requestMethod"],
    requestTimeout: form.requestTimeout,
    redirectSuccess: form.redirectSuccess,
    schedule: {
      timezone: form.schedule.timezone,
      expiresAt: 0,
      minutes: parseScheduleArray(form.schedule.minutes),
      hours: parseScheduleArray(form.schedule.hours),
      mdays: parseScheduleArray(form.schedule.mdays),
      months: parseScheduleArray(form.schedule.months),
      wdays: parseScheduleArray(form.schedule.wdays),
    },
  };

  const headers: Record<string, string> = {};
  for (const h of form.headers) {
    if (h.key.trim()) headers[h.key.trim()] = h.value;
  }
  if (Object.keys(headers).length > 0 || form.body) {
    config.extendedData = { headers, body: form.body };
  }

  // HTTP 基本认证（未启用则不传）
  if (form.auth.enable) {
    config.auth = {
      enable: true,
      user: form.auth.user,
      password: form.auth.password,
    };
  }

  // 通知设置
  config.notification = {
    onFailure: form.notification.onFailure,
    onFailureCount: Math.max(1, form.notification.onFailureCount),
    onSuccess: form.notification.onSuccess,
    onDisable: form.notification.onDisable,
    onSslCertExpiry: form.notification.onSslCertExpiry,
    onSslCertExpirySeconds: form.notification.onSslCertExpirySeconds,
  };

  return config;
}
