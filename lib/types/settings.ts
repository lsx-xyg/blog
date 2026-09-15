/**
 * settings 相关类型定义。
 *
 * 单独成文件的原因：
 * - 被 @/lib/settings、@/lib/storage、后台组件等多处引用
 * - 避免类型层与实现层形成循环依赖
 */
import { StorageDriverType } from "@/lib/types/storage";

/** 站点设置类型 */
export type SiteSettings = {
    name: string;
    description: string;
    seoDescription: string;
    logoUrl: string;
    faviconUrl: string;
    siteUrl: string;
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
/** 存储配置类型 */

export type StorageSettings = {
    driver: StorageDriverType;
    github: {
        owner: string;
        repo: string;
        branch: string;
        cdnBase: string;
        directory: string; // 仓库内的子目录（如 uploads / backups）
        token: string; // 用户输入的明文（保存时用）
        tokenConfigured?: boolean; // 是否已配置（加载时显示用，不返回明文）
    };
    s3: {
        endpoint: string;
        bucket: string;
        region: string;
        directory: string; // bucket 内的子目录
        accessKey: string; // 用户输入的明文（保存时用）
        secretKey: string; // 用户输入的明文（保存时用）
        accessKeyConfigured?: boolean; // 是否已配置
        secretKeyConfigured?: boolean; // 是否已配置
    };
    local: {
        uploadDir: string;
        directory: string; // uploadDir 内的子目录
    };
};

/** 私有存储配置类型（与公开存储结构相同，用于备份等敏感数据） */
export type PrivateStorageSettings = StorageSettings;

/** 定时任务部署平台类型 */
export const CronDeployPlatform = {
    VERCEL: "VERCEL",
    SERVER: "SERVER",
} as const;

export type CronDeployPlatform = typeof CronDeployPlatform[keyof typeof CronDeployPlatform];

export const CRON_DEPLOY_PLATFORM_VALUES = Object.values(CronDeployPlatform) as CronDeployPlatform[];
