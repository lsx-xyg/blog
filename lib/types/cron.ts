
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
/** 执行历史列表项（ExecutionInfo，官方文档） */

export type CronJobHistoryItem = {
  jobId: number;
  /** 状态码：0=OK，其他见 CronJobExecutionStatus */
  status: number;
  /** 执行时长（毫秒） */
  duration: number;
  /** 执行时间（Unix 秒） */
  execution: number;
  url: string;
  /** HTTP 方法（0-8，同 RequestMethod） */
  method: number;
  /** 执行详情标识符 */
  id: number;
};
/** 单次执行详情（ExecutionDetails，官方文档） */

export type CronJobExecutionDetail = {
  jobId: number;
  jobTitle: string;
  url: string;
  id: number;
  execution: number;
  plannedExecution: number;
  executionJitter: number;
  duration: number;
  status: number;
  requestTimeout: number;
  requestMethod: number;
  redirectSuccess: boolean;
  sslCertExpiry: number;
  effectiveURL: string;
  schedule?: CronJobSchedule;
  /** 性能统计（毫秒） */
  times?: {
    dnsLookup: number;
    connection: number;
    tlsHandshake: number;
    firstByte: number;
    total: number;
  };
  httpStatusCode: number;
  headers?: {
    response: Record<string, string> | string;
  };
  body?: string | { type: string; content: string };
  saveResponses: boolean;
};
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
