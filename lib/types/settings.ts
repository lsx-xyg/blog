/**
 * settings 相关类型定义。
 *
 * 单独成文件的原因：
 * - 被 @/lib/settings/server、@/lib/storage、后台组件等多处引用
 * - 避免类型层与实现层形成循环依赖
 */
import { StorageDriverType, type GithubUrlStyle } from '@/lib/types/storage';

/** 站点设置类型 */
export type SiteSettings = {
  name: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  logoUrl: string;
  faviconUrl: string;
  siteUrl: string;
};
/** 站点 URL 等 SEO 基础设置见 SiteSettings；本组为搜索收录推送设置 */

/**
 * 搜索收录设置（IndexNow 即时索引协议）。
 *
 * Google 不参与 IndexNow（其 Indexing API 仅限 JobPosting/BroadcastEvent，
 * sitemap ping 端点已下线），Google 侧靠 sitemap + Search Console 覆盖。
 */
export type SeoSettings = {
  /** 文章发布/更新时是否自动推送 IndexNow（Bing/Yandex/Seznam/Naver 共享通知） */
  indexNowEnabled: boolean;
  /** IndexNow 密钥（8~128 位 hex；公开值，经 /{key}.txt 验证站点所有权，空 = 首次推送时自动生成） */
  indexNowKey: string;
};
/** 社交链接类型 */

export type SocialLinks = {
  github: string;
  twitter: string;
  email: string;
  rss: string;
};
/** 页脚设置类型 */

export type FooterSettings = {
  copyright: string;
  icp: string;
};
/** giscus 评论配置类型 */

export type GiscusSettings = {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  /** 评论开关：false 时文章页不渲染评论区 */
  enabled: boolean;
};
/** 定时任务配置类型 */

export type CronSettings = {
  /** 部署平台（VERCEL/SERVER，默认 VERCEL） */
  deployPlatform: CronDeployPlatform;
  /** 定时任务接口鉴权密钥（敏感信息） */
  secret: string;
  /** 是否已配置（加载时显示用，不返回明文） */
  secretConfigured?: boolean;
  /** cron-job.org API Key（敏感信息，VERCEL 模式下需要） */
  jobApiKey: string;
  /** 是否已配置（加载时显示用，不返回明文） */
  jobApiKeyConfigured?: boolean;
};
/** 旧版存储配置类型（公开组的形态）。
 *  新代码请用档案结构（`lib/storage/server/profiles.ts` 的 ProfileConfig）；
 *  本类型保留给 registry 声明与「档案未播种 / 通道未绑定」时的回退配置。 */

export type StorageSettings = {
  driver: StorageDriverType;
  github: {
    owner: string;
    repo: string;
    branch: string;
    cdnBase: string;
    /** URL 拼接方式：path = /{branch}/ 普通路径（默认）；at = @{branch} jsDelivr 特有格式 */
    urlStyle: GithubUrlStyle;
    directory: string; // 仓库内的子目录（如 uploads / backups）
    token: string; // 用户输入的明文（保存时用）
    tokenConfigured?: boolean; // 是否已配置（加载时显示用，不返回明文）
  };
  s3: {
    endpoint: string;
    bucket: string;
    region: string;
    directory: string; // bucket 内的子目录
    /** 公开访问域名（R2 绑定的自定义域名 / r2.dev 域名，OSS 的 CDN 域名等）。
     *  公开通道的档案必须配置，否则图片无公网 URL。 */
    publicBase: string;
    accessKey: string; // 用户输入的明文（保存时用）
    secretKey: string; // 用户输入的明文（保存时用）
    accessKeyConfigured?: boolean; // 是否已配置
    secretKeyConfigured?: boolean; // 是否已配置
  };
  local: {
    uploadDir: string;
    directory: string; // uploadDir 内的子目录
  };
  webdav: {
    /** WebDAV 服务地址（如 https://dav.jianguoyun.com/dav/） */
    url: string;
    username: string;
    password: string; // 用户输入的明文（保存时用）
    passwordConfigured?: boolean; // 是否已配置
    directory: string; // 服务内的子目录
  };
};

/** 旧版私有存储配置类型（结构与公开存储相同）。
 *  当前存储由「档案池 + 通道绑定」管理（storage_profiles 表 + storage.binding.*），
 *  本类型只在升级兼容路径上使用：档案池未播种 / 备份通道未绑定时作为回退配置。 */
export type PrivateStorageSettings = StorageSettings;

/** 备份保留策略类型（两项均为 0 表示不自动清理） */
export type BackupSettings = {
  /** 保留天数：创建时间早于 N 天的备份会被清理（0 = 不限制天数） */
  retentionDays: number;
  /** 保留条数：按创建时间倒序只保留最新 N 条（0 = 不限制条数） */
  retentionCount: number;
};

/** 定时任务部署平台类型 */
export const CronDeployPlatform = {
  VERCEL: 'VERCEL',
  SERVER: 'SERVER',
} as const;

export type CronDeployPlatform = (typeof CronDeployPlatform)[keyof typeof CronDeployPlatform];

export const CRON_DEPLOY_PLATFORM_VALUES = Object.values(
  CronDeployPlatform,
) as CronDeployPlatform[];
