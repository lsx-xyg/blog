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
      title: "[blog:publish_scheduled] 定时发布扫描（每分钟）",
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
      title: "[blog:backup] 自动备份（每天 03:00）",
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

/** 系统任务标题项目名前缀（唯一标识空间，防止与其他应用任务冲突） */
export const SYS_TITLE_TAG = "blog";

/**
 * 从任务标题解析预设 key（唯一对应，不依赖名称文本）
 * 标题格式：`[blog:backup] 自动备份（每天 03:00）`（项目名:业务key）
 * 非该格式返回 null
 */
export function getPresetKeyFromTitle(title: string): string | null {
  const m = title.match(
    new RegExp("^\\[" + SYS_TITLE_TAG + ":([a-z0-9_]+)\\]"),
  );
  return m ? m[1] : null;
}

/** 判断任务是否属于系统任务（仅标题带 [blog:key] 前缀的系统任务） */
export function isSystemJob(job: CronJob): boolean {
  return getPresetKeyFromTitle(job.title) !== null;
}

/** 匹配任务对应的系统任务预设（无匹配返回 null）
 * 仅按标题中的 [blog:key] 精确匹配 */
export function matchSystemJob(job: CronJob): SystemJobPreset | null {
  const key = getPresetKeyFromTitle(job.title);
  return key ? getSystemJobPreset(key) : null;
}

/** 按 key 取预设 */
export function getSystemJobPreset(key: string): SystemJobPreset | null {
  return SYSTEM_JOB_PRESETS.find((p) => p.key === key) || null;
}
