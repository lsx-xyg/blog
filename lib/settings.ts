/**
 * 站点设置数据访问层（settings 键值表）
 *
 * 设置项约定：
 * - site.name: 站点名称
 * - site.description: 站点简介
 * - site.seo_description: SEO 描述
 * - site.logo_url: Logo 图片 URL
 * - site.favicon_url: Favicon URL
 * - social.github: GitHub 链接
 * - social.twitter: Twitter/X 链接
 * - social.email: 邮箱
 * - social.rss: RSS 链接（默认 /rss.xml）
 * - about.content: 关于页面 Markdown 内容
 * - admin.path: 后台路径（env 优先，DB 可覆盖）
 * - footer.copyright: 页脚版权文字
 * - footer.icp: ICP 备案号
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/** 获取单个设置 */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0].value as T;
}

/** 设置单个配置（upsert：存在则更新，不存在则插入） */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as Record<string, unknown> })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as Record<string, unknown> },
    });
}

/** 删除单个配置（用于清空配置，回退到环境变量/默认值） */
export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}

/** 批量设置配置 */
export async function setSettingsBatch(
  items: { key: string; value: unknown }[],
): Promise<void> {
  for (const item of items) {
    await setSetting(item.key, item.value);
  }
}

/** 获取所有设置 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/** 站点设置类型 */
export type SiteSettings = {
  name: string;
  description: string;
  seoDescription: string;
  logoUrl: string;
  faviconUrl: string;
  siteUrl: string;
};

/** 默认站点设置 */
const DEFAULT_SITE_SETTINGS: SiteSettings = {
  name: "林圣轩blog",
  description: "技术写作与生活记录",
  seoDescription: "林圣轩的个人博客，分享技术写作与生活记录",
  logoUrl: "",
  faviconUrl: "",
  siteUrl: "",
};

/** 获取站点设置（合并默认值） */
export async function getSiteSettings(): Promise<SiteSettings> {
  const [name, description, seoDescription, logoUrl, faviconUrl, siteUrl] = await Promise.all([
    getSetting<string>("site.name"),
    getSetting<string>("site.description"),
    getSetting<string>("site.seo_description"),
    getSetting<string>("site.logo_url"),
    getSetting<string>("site.favicon_url"),
    getSetting<string>("site.site_url"),
  ]);

  return {
    name: name ?? DEFAULT_SITE_SETTINGS.name,
    description: description ?? DEFAULT_SITE_SETTINGS.description,
    seoDescription: seoDescription ?? DEFAULT_SITE_SETTINGS.seoDescription,
    logoUrl: logoUrl ?? DEFAULT_SITE_SETTINGS.logoUrl,
    faviconUrl: faviconUrl ?? DEFAULT_SITE_SETTINGS.faviconUrl,
    // 环境变量优先级最高，其次 DB，最后默认值
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || siteUrl || DEFAULT_SITE_SETTINGS.siteUrl,
  };
}

/** 社交链接类型 */
export type SocialLinks = {
  github: string;
  twitter: string;
  email: string;
  rss: string;
};

/** 默认社交链接 */
const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  github: "",
  twitter: "",
  email: "",
  rss: "/rss.xml",
};

/** 获取社交链接 */
export async function getSocialLinks(): Promise<SocialLinks> {
  const [github, twitter, email, rss] = await Promise.all([
    getSetting<string>("social.github"),
    getSetting<string>("social.twitter"),
    getSetting<string>("social.email"),
    getSetting<string>("social.rss"),
  ]);

  return {
    github: github ?? DEFAULT_SOCIAL_LINKS.github,
    twitter: twitter ?? DEFAULT_SOCIAL_LINKS.twitter,
    email: email ?? DEFAULT_SOCIAL_LINKS.email,
    rss: rss ?? DEFAULT_SOCIAL_LINKS.rss,
  };
}

/** 页脚设置类型 */
export type FooterSettings = {
  copyright: string;
  icp: string;
};

/** 获取页脚设置 */
export async function getFooterSettings(): Promise<FooterSettings> {
  const [copyright, icp] = await Promise.all([
    getSetting<string>("footer.copyright"),
    getSetting<string>("footer.icp"),
  ]);

  const year = new Date().getFullYear();
  return {
    copyright: copyright ?? `© ${year} 林圣轩blog. All rights reserved.`,
    icp: icp ?? "",
  };
}

/** 获取关于页面内容 */
export async function getAboutContent(): Promise<string> {
  const content = await getSetting<string>("about.content");
  return content ?? "## 关于我\n\n这里是关于页面的内容，可以在后台设置中编辑。";
}

/** 设置关于页面内容 */
export async function setAboutContent(content: string): Promise<void> {
  await setSetting("about.content", content);
}

/** giscus 评论配置类型 */
export type GiscusConfig = {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
};

/**
 * 获取 giscus 评论配置（环境变量优先级最高，DB 次之，默认值兜底）
 *
 * 环境变量：
 * - NEXT_PUBLIC_GISCUS_REPO
 * - NEXT_PUBLIC_GISCUS_REPO_ID
 * - NEXT_PUBLIC_GISCUS_CATEGORY
 * - NEXT_PUBLIC_GISCUS_CATEGORY_ID
 *
 * DB settings：
 * - giscus.repo
 * - giscus.repo_id
 * - giscus.category
 * - giscus.category_id
 */
export async function getGiscusConfig(): Promise<GiscusConfig> {
  const [repo, repoId, category, categoryId] = await Promise.all([
    getSetting<string>("giscus.repo"),
    getSetting<string>("giscus.repo_id"),
    getSetting<string>("giscus.category"),
    getSetting<string>("giscus.category_id"),
  ]);

  return {
    repo: process.env.NEXT_PUBLIC_GISCUS_REPO || repo || "",
    repoId: process.env.NEXT_PUBLIC_GISCUS_REPO_ID || repoId || "",
    category: process.env.NEXT_PUBLIC_GISCUS_CATEGORY || category || "Announcements",
    categoryId: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID || categoryId || "",
  };
}

/** 定时任务配置类型 */
export type CronConfig = {
  /** 部署平台（VERCEL/SERVER，默认 VERCEL） */
  deployPlatform: "VERCEL" | "SERVER";
  /** 定时任务接口鉴权密钥（敏感信息） */
  cronSecret: string;
  /** cron-job.org API Key（敏感信息，VERCEL 模式下需要） */
  cronJobApiKey: string;
};

/**
 * 获取定时任务配置（环境变量优先级最高，DB 次之，默认值兜底）
 *
 * 环境变量：
 * - DEPLOY_PLATFORM
 * - CRON_SECRET
 * - CRON_JOB_API_KEY
 *
 * DB settings：
 * - cron.deploy_platform
 * - cron.secret（AES-256-GCM 加密）
 * - cron.job_api_key（AES-256-GCM 加密）
 *
 * 注意：DEPLOY_PLATFORM 在 instrumentation.ts（应用启动时）使用的是环境变量，
 * 因为应用启动后无法动态切换 node-cron。API 接口中使用的是动态配置。
 */
export async function getCronConfig(): Promise<CronConfig> {
  const [deployPlatformDb, cronSecretEncrypted, cronJobApiKeyEncrypted] = await Promise.all([
    getSetting<string>("cron.deploy_platform"),
    getSetting<string>("cron.secret"),
    getSetting<string>("cron.job_api_key"),
  ]);

  // 动态导入加密工具（避免循环依赖）
  const { decryptIfAvailable } = await import("@/lib/crypto");

  const deployPlatformRaw =
    process.env.DEPLOY_PLATFORM || deployPlatformDb || "VERCEL";
  const deployPlatform =
    deployPlatformRaw.toUpperCase() === "SERVER" ? "SERVER" : "VERCEL";

  return {
    deployPlatform,
    cronSecret:
      process.env.CRON_SECRET || decryptIfAvailable(cronSecretEncrypted) || "",
    cronJobApiKey:
      process.env.CRON_JOB_API_KEY || decryptIfAvailable(cronJobApiKeyEncrypted) || "",
  };
}
