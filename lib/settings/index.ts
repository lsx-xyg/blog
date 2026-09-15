/**
 * 站点设置数据访问层（对外入口）。
 *
 * 本文件是 @/lib/settings 的唯一出口，负责：
 * - 再导出层 0 读写（store）
 * - 再导出层 2 getConfig
 * - 定义层 3 门面函数（站点/社交/页脚/关于/giscus/cron）
 *
 * 内部结构见 ./settings/ 目录：
 * - ./settings/store.ts       层 0：settings 表读写
 * - ./settings/registry.ts    层 1：registry 声明
 * - ./settings/get-config.ts  层 2：getConfig
 * - ./settings/types.ts       类型定义
 *
 * 注意：admin.path 不归本文件管理，在调用方（route.ts）直接读。
 */
import { StorageDriverType } from "@/lib/types/storage";
import { getConfig } from "@/lib/settings/get-config";
import { getConfigGroup } from "@/lib/settings/get-config-groups";
import type {
    CronDeployPlatform,
    CronSettings,
    FooterSettings,
    GiscusSettings,
    SiteSettings,
    SocialLinks,
    StorageSettings,
    PrivateStorageSettings
} from "@/lib/types/settings";

/* ---------------- 再导出：层 0 ---------------- */
export * from "@/lib/settings/store";

/* ---------------- 再导出：层 2 ---------------- */
export { getConfig, getConfigGroup };

/* ---------------- 再导出：registry 类型 ---------------- */
export type * from "@/lib/settings/registry";

/**
 * 获取站点设置。
 *
 * 字段：name / description / seoDescription / logoUrl / faviconUrl / siteUrl
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  return (await getConfigGroup("site"));
}

/**
 * 获取社交链接。
 *
 * 字段：github / twitter / email / rss
 */
export async function getSocialLinks(): Promise<SocialLinks> {
  return (await getConfigGroup("social"));
}

/**
 * 获取页脚设置。
 *
 * 特殊行为：copyright 为空（falsy）时，动态生成
 * `© {当前年份} 林圣轩blog. All rights reserved.`。
 */
export async function getFooterSettings(): Promise<FooterSettings> {
  const [copyright, icp] = await Promise.all([
    getConfig("footer.copyright"),
    getConfig("footer.icp"),
  ]);

  const year = new Date().getFullYear();
  return {
    copyright: copyright || `© ${year} 林圣轩blog. All rights reserved.`,
    icp,
  };
}

/**
 * 获取关于页面内容（Markdown）。
 */
export async function getAboutContent(): Promise<string> {
  return getConfig("about.content");
}

/**
 * 设置关于页面内容（Markdown）。
 *
 * @param content 关于页 Markdown 内容
 */
export async function setAboutContent(content: string): Promise<void> {
  const { setSetting } = await import("@/lib/settings/store");
  await setSetting("about.content", content);
}

/**
 * 获取 giscus 评论配置。
 *
 * 字段：repo / repoId / category / categoryId
 * 优先级：env > DB > default（由 getConfig 统一处理）。
 */
export async function getGiscusSettings(): Promise<GiscusSettings> {
  return (await getConfigGroup("giscus"));
}

/**
 * 获取定时任务配置。
 *
 * 优先级：env > DB（解密）> default。
 * deployPlatform 归一化由 registry 的 transform 负责，本函数不再处理。
 *
 * 注意：DEPLOY_PLATFORM 在 instrumentation.ts（应用启动时）使用的是环境变量，
 * 因为应用启动后无法动态切换 node-cron。API 接口中使用的是动态配置。
 */
export async function getCronSettings(): Promise<CronSettings> {
  return (await getConfigGroup("cron"));
}

/**
 * 从 DB 读取存储配置（环境变量优先级最高，DB 次之，默认值兜底）
 *
 * 敏感信息从 DB 读取后解密，环境变量中的敏感信息优先级最高。
 */
export async function getStorageSettings(): Promise<StorageSettings> {
  return (await getConfigGroup("storage"));
}

/**
 * 从 DB 读取私有存储配置（用于备份等敏感数据）
 *
 * 配置前缀：storagePrivate.*
 * 环境变量前缀：STORAGE_PRIVATE_* / GITHUB_PRIVATE_* / S3_PRIVATE_*
 */
export async function getPrivateStorageSettings(): Promise<PrivateStorageSettings> {
  return (await getConfigGroup("storagePrivate"));
}

// ========================

/**
 * 获取部署平台
 */
export async function getDeployPlatform(): Promise<CronDeployPlatform> {
  const {deployPlatform} = await getCronSettings();
  return deployPlatform;
}

/**
 * 获取存储驱动类型
 */
export async function getStorageDriverType(): Promise<StorageDriverType> {
  const {driver} = await getStorageSettings();
  return driver;
}

/**
 * 获取存储驱动类型
 */
export async function getCronJobApiKey(): Promise<string> {
  const {jobApiKey} = await getCronSettings();
  return jobApiKey;
}
