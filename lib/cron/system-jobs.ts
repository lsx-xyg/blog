/**
 * 系统定时任务预设
 *
 * 站点功能依赖的定时任务（区别于用户自由创建的任务），由预设配置驱动创建。
 * 当前 1 个：定时发布扫描。未来新增系统任务（备份/清理等）时在此追加预设即可。
 *
 * 识别约定：
 * - 新创建的任务 title 使用固定格式 `[系统] <名称>（<周期>）`
 * - 匹配历史任务（旧 title "博客定时发布扫描（每分钟）"）通过名称包含判断，保证平滑兼容
 */
import { RequestMethod, type CronJob, type CronJobConfig } from "@/lib/types/cron";

export type SystemJobPreset = {
  /** 预设唯一键 */
  key: string;
  /** 展示名称 */
  name: string;
  /** 描述（管理页展示） */
  description: string;
  /** 是否支持手动触发（run） */
  supportsRun?: boolean;
  /** 创建时的任务配置 */
  createConfig: (ctx: { siteUrl: string; cronSecret: string }) => CronJobConfig;
};

export const SYSTEM_JOB_PRESETS: SystemJobPreset[] = [
  {
    key: "publish_scheduled",
    name: "定时发布扫描",
    description: "每分钟扫描一次，自动发布所有到期的定时文章",
    supportsRun: true,
    createConfig: ({ siteUrl, cronSecret }) => ({
      title: "[系统:publish_scheduled] 定时发布扫描（每分钟）",
      url: `${siteUrl}/api/cron/publish-scheduled`,
      enabled: true,
      saveResponses: false,
      requestMethod: RequestMethod.GET,
      requestTimeout: 30,
      extendedData: {
        headers: { "X-Cron-Secret": cronSecret },
      },
      schedule: {
        timezone: "Asia/Shanghai",
        expiresAt: 0,
        hours: [-1],
        mdays: [-1],
        minutes: [-1],
        months: [-1],
        wdays: [-1],
      },
    }),
  },
  {
    key: "backup",
    name: "自动备份",
    description: "每天凌晨 03:00 自动备份全部业务数据，上传到配置的存储驱动",
    supportsRun: true,
    createConfig: ({ siteUrl, cronSecret }) => ({
      title: "[系统:backup] 自动备份（每天 03:00）",
      url: `${siteUrl}/api/cron/backup`,
      enabled: true,
      saveResponses: false,
      requestMethod: RequestMethod.GET,
      requestTimeout: 60,
      extendedData: {
        headers: { "X-Cron-Secret": cronSecret },
      },
      schedule: {
        timezone: "Asia/Shanghai",
        expiresAt: 0,
        hours: [3],
        mdays: [-1],
        minutes: [0],
        months: [-1],
        wdays: [-1],
      },
    }),
  },
];

/**
 * 从任务标题解析预设 key（唯一对应，不依赖名称文本）
 * 标题格式：`[系统:backup] 自动备份（每天 03:00）`
 * 解析失败（旧格式或无 key）返回 null
 */
export function getPresetKeyFromTitle(title: string): string | null {
  const m = title.match(/^\[系统:([a-z0-9_]+)\]/);
  return m ? m[1] : null;
}

/** 判断任务是否属于系统任务（标题带 [系统:key] / [系统] 前缀，或名称匹配预设，兼容旧标题） */
export function isSystemJob(job: CronJob): boolean {
  return (
    getPresetKeyFromTitle(job.title) !== null ||
    job.title.startsWith("[系统]") ||
    SYSTEM_JOB_PRESETS.some((p) => job.title.includes(p.name))
  );
}

/** 匹配任务对应的系统任务预设（无匹配返回 null）
 * 优先按标题中的 [系统:key] 精确匹配，旧标题按名称兜底 */
export function matchSystemJob(job: CronJob): SystemJobPreset | null {
  const key = getPresetKeyFromTitle(job.title);
  if (key) {
    const preset = getSystemJobPreset(key);
    if (preset) return preset;
  }
  return (
    SYSTEM_JOB_PRESETS.find(
      (p) => job.title.startsWith("[系统]") && job.title.includes(p.name),
    ) ||
    SYSTEM_JOB_PRESETS.find((p) => job.title.includes(p.name)) ||
    null
  );
}

/** 按 key 取预设 */
export function getSystemJobPreset(key: string): SystemJobPreset | null {
  return SYSTEM_JOB_PRESETS.find((p) => p.key === key) || null;
}
