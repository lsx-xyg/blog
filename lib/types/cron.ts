
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
  /** HTTP 基本认证（JobAuth，官方文档） */
  auth?: {
    enable: boolean;
    user: string;
    password: string;
  };
  /** 通知设置（JobNotificationSettings，官方文档） */
  notification?: {
    onFailure: boolean;
    onFailureCount: number;
    onSuccess: boolean;
    onDisable: boolean;
    onSslCertExpiry: boolean;
    onSslCertExpirySeconds: number;
  };
};
/** 执行历史列表项（cron-job.org history，官方字段） */

export type CronJobHistoryItem = {
  jobLogId: number;
  jobId: number;
  /** 执行详情标识符（字符串，详情接口用） */
  identifier: string;
  /** 实际执行时间（Unix 秒） */
  date: number;
  /** 计划执行时间（Unix 秒） */
  datePlanned: number;
  /** 执行抖动（毫秒） */
  jitter: number;
  url: string;
  /** 执行时长（毫秒） */
  duration: number;
  /** 状态码（history 语义，配合 statusText 使用） */
  status: number;
  /** 官方状态文本：OK / REQUEST_FAILED / NO_RESPONSE / TIMEOUT / SSL_CERT_INVALID / REQUEST_TOO_LARGE / INTERNAL_ERROR / FAILING_SINCE */
  statusText: string;
  /** HTTP 状态码（仅 statusText=OK 时有意义） */
  httpStatus: number;
  /** 响应头（原始文本或 false） */
  headers: string | false;
  /** 响应体（原始文本或 false） */
  body: string | false;
  /** 性能统计（微秒） */
  stats?: CronJobExecutionStats;
  sslCertExpiry: number;
};

/** 执行性能统计（cron-job.org stats，微秒） */
export type CronJobExecutionStats = {
  nameLookup: number;
  connect: number;
  appConnect: number;
  preTransfer: number;
  startTransfer: number;
  total: number;
};

/** 单次执行详情（与列表项同构，额外含响应头/体） */
export type CronJobExecutionDetail = CronJobHistoryItem;
/** 执行状态码（官方文档） */

export const CronJobExecutionStatus = {
  OK: 0,
  /** HTTP 错误 */
  REQUEST_FAILED: 1,
  /** 无响应 */
  NO_RESPONSE: 2,
  /** 请求超时 */
  TIMEOUT: 3,
  /** SSL 证书无效 */
  SSL_CERT_INVALID: 4,
  /** 请求体过大 */
  REQUEST_TOO_LARGE: 5,
  /** 内部错误 */
  INTERNAL_ERROR: 6,
  /** 持续失败 */
  FAILING_SINCE: 7,
} as const;

export type CronJobExecutionStatus =
  (typeof CronJobExecutionStatus)[keyof typeof CronJobExecutionStatus];
