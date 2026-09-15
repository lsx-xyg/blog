/**
 * 层 1：registry 配置声明。
 *
 * 加配置只加一行：在 registry 里追加一个条目。
 * 键名为语义化名（供 getConfig / 门面函数使用），
 * key 字段为实际 DB key（可与语义化名不同，如 site.seoDescription）。
 * 
 * 加密密钥：ENCRYPTION_KEY 环境变量（32 字节 Base64）
 *
 * 设置项约定（语义化名 → DB key [env]）：
 * - site.name           → site.name
 * - site.description    → site.description
 * - site.seoDescription → site.seo_description
 * - site.logoUrl        → site.logo_url
 * - site.faviconUrl     → site.favicon_url
 * - site.siteUrl        → site.site_url
 *                         [env: NEXT_PUBLIC_SITE_URL]
 * - social.github       → social.github
 * - social.twitter      → social.twitter
 * - social.email        → social.email
 * - social.rss          → social.rss（默认 /rss.xml）
 * - footer.copyright    → footer.copyright（为空时动态生成年份）
 * - footer.icp          → footer.icp
 * - about.content       → about.content
 * - giscus.repo         → giscus.repo
 *                         [env: NEXT_PUBLIC_GISCUS_REPO]
 * - giscus.repoId       → giscus.repo_id
 *                         [env: NEXT_PUBLIC_GISCUS_REPO_ID]
 * - giscus.category     → giscus.category（默认 Announcements）
 *                         [env: NEXT_PUBLIC_GISCUS_CATEGORY]
 * - giscus.categoryId   → giscus.category_id
 *                         [env: NEXT_PUBLIC_GISCUS_CATEGORY_ID]
 * - cron.deployPlatform → cron.deploy_platform（归一化为 VERCEL/SERVER）
 *                         [env: DEPLOY_PLATFORM]
 * - cron.secret         → cron.secret（敏感，AES-256-GCM）
 *                         [env: CRON_SECRET]
 * - cron.jobApiKey      → cron.job_api_key（敏感，AES-256-GCM）
 *                         [env: CRON_JOB_API_KEY]
 * - storage.driver      → storage.driver（归一化为 LOCAL/GITHUB/S3）
 *                         [env: STORAGE_DRIVER]
 * - storage.github.owner    → storage.github.owner
 *                             [env: GITHUB_STORAGE_OWNER]
 * - storage.github.repo     → storage.github.repo
 *                             [env: GITHUB_STORAGE_REPO]
 * - storage.github.branch   → storage.github.branch
 *                             [env: GITHUB_STORAGE_BRANCH]
 * - storage.github.cdnBase  → storage.github.cdn_base
 *                             [env: GITHUB_STORAGE_CDN_BASE]
 * - storage.github.token    → storage.github.token（敏感，AES-256-GCM）
 *                             [env: GITHUB_STORAGE_TOKEN]
 * - storage.s3.endpoint     → storage.s3.endpoint
 *                             [env: S3_ENDPOINT]
 * - storage.s3.bucket       → storage.s3.bucket
 *                             [env: S3_BUCKET]
 * - storage.s3.region       → storage.s3.region（默认 auto）
 *                             [env: S3_REGION]
 * - storage.s3.accessKey    → storage.s3.access_key（敏感，AES-256-GCM）
 *                             [env: S3_ACCESS_KEY]
 * - storage.s3.secretKey    → storage.s3.secret_key（敏感，AES-256-GCM）
 *                             [env: S3_SECRET_KEY]
 * - storage.local.uploadDir → storage.local.upload_dir
 *                             [env: LOCAL_UPLOAD_DIR]
 *
 * 优先级统一为：env > DB > default（仅 getConfig 一处合并）。
 */

import { StorageDriverType } from "@/lib/types/storage";
import { CronDeployPlatform } from "@/lib/types/settings";

/**
 * 单个配置项声明。
 *
 * @property key       DB 中的设置键
 * @property env       环境变量名（可选，优先级最高）
 * @property default   默认值（优先级最低，其类型决定 getConfig 返回类型）
 * @property secret    是否为敏感字段（为 true 时从 DB 读出的值会先解密）
 * @property transform 从原始字符串到目标类型的转换（可选）
 */
export type ConfigDef<T> = {
    key: string;
    env?: string;
    default: T;
    secret?: boolean;
    transform?: (raw: string) => T;
};

export const registry = {
    "site.name": {
        key: "site.name",
        default: "林圣轩blog",
    },
    "site.description": {
        key: "site.description",
        default: "技术写作与生活记录",
    },
    "site.seoDescription": {
        key: "site.seo_description",
        default: "林圣轩的个人博客，分享技术写作与生活记录",
    },
    "site.logoUrl": {
        key: "site.logo_url",
        default: "",
    },
    "site.faviconUrl": {
        key: "site.favicon_url",
        default: "",
    },
    "site.siteUrl": {
        key: "site.site_url",
        env: "NEXT_PUBLIC_SITE_URL",
        default: "",
    },
    "social.github": {
        key: "social.github",
        default: "",
    },
    "social.twitter": {
        key: "social.twitter",
        default: "",
    },
    "social.email": {
        key: "social.email",
        default: "",
    },
    "social.rss": {
        key: "social.rss",
        default: "/rss.xml",
    },
    "footer.copyright": {
        key: "footer.copyright",
        default: "",
    },
    "footer.icp": {
        key: "footer.icp",
        default: "",
    },
    "about.content": {
        key: "about.content",
        default:
            "## 关于我\n\n这里是关于页面的内容，可以在后台设置中编辑。",
    },
    "giscus.repo": {
        key: "giscus.repo",
        env: "NEXT_PUBLIC_GISCUS_REPO",
        default: "",
    },
    "giscus.repoId": {
        key: "giscus.repo_id",
        env: "NEXT_PUBLIC_GISCUS_REPO_ID",
        default: "",
    },
    "giscus.category": {
        key: "giscus.category",
        env: "NEXT_PUBLIC_GISCUS_CATEGORY",
        default: "Announcements",
    },
    "giscus.categoryId": {
        key: "giscus.category_id",
        env: "NEXT_PUBLIC_GISCUS_CATEGORY_ID",
        default: "",
    },
    "cron.deployPlatform": {
        key: "cron.deploy_platform",
        env: "DEPLOY_PLATFORM",
        default: CronDeployPlatform.VERCEL,
        transform: (v) => (v.toUpperCase() === "SERVER" ? CronDeployPlatform.SERVER : CronDeployPlatform.VERCEL),
    },
    "cron.secret": {
        key: "cron.secret",
        env: "CRON_SECRET",
        default: "",
        secret: true,
    },
    "cron.jobApiKey": {
        key: "cron.job_api_key",
        env: "CRON_JOB_API_KEY",
        default: "",
        secret: true,
    },
    "storage.driver": {
        key: "storage.driver",
        env: "STORAGE_DRIVER",
        default: StorageDriverType.LOCAL,
        // 归一化：任何非 GITHUB/S3（忽略大小写）的值都落到 LOCAL
        transform: (v) => {
            const u = v.toUpperCase();
            return u === StorageDriverType.GITHUB || u === StorageDriverType.S3 ? u : StorageDriverType.LOCAL;
        },
    },
    "storage.github.owner": {
        key: "storage.github.owner",
        env: "GITHUB_STORAGE_OWNER",
        default: "lsx-xyg",
    },
    "storage.github.repo": {
        key: "storage.github.repo",
        env: "GITHUB_STORAGE_REPO",
        default: "public",
    },
    "storage.github.branch": {
        key: "storage.github.branch",
        env: "GITHUB_STORAGE_BRANCH",
        default: "main",
    },
    "storage.github.cdnBase": {
        key: "storage.github.cdn_base",
        env: "GITHUB_STORAGE_CDN_BASE",
        default: "https://cdn.jsdelivr.net/gh",
    },
    "storage.github.directory": {
        key: "storage.github.directory",
        env: "GITHUB_STORAGE_DIRECTORY",
        default: "",
    },
    "storage.github.token": {
        key: "storage.github.token",
        env: "GITHUB_STORAGE_TOKEN",
        default: "",
        secret: true,
    },
    "storage.s3.endpoint": {
        key: "storage.s3.endpoint",
        env: "S3_ENDPOINT",
        default: "",
    },
    "storage.s3.bucket": {
        key: "storage.s3.bucket",
        env: "S3_BUCKET",
        default: "",
    },
    "storage.s3.region": {
        key: "storage.s3.region",
        env: "S3_REGION",
        default: "auto",
    },
    "storage.s3.directory": {
        key: "storage.s3.directory",
        env: "S3_DIRECTORY",
        default: "",
    },
    "storage.s3.accessKey": {
        key: "storage.s3.access_key",
        env: "S3_ACCESS_KEY",
        default: "",
        secret: true,
    },
    "storage.s3.secretKey": {
        key: "storage.s3.secret_key",
        env: "S3_SECRET_KEY",
        default: "",
        secret: true,
    },
    "storage.local.uploadDir": {
        key: "storage.local.upload_dir",
        env: "LOCAL_UPLOAD_DIR",
        default: "public/uploads",
    },
    "storage.local.directory": {
        key: "storage.local.directory",
        env: "LOCAL_STORAGE_DIRECTORY",
        default: "",
    },
    // === 私有存储配置（用于备份等敏感数据）===
    "storagePrivate.driver": {
        key: "storage_private.driver",
        env: "STORAGE_PRIVATE_DRIVER",
        default: StorageDriverType.LOCAL,
        transform: (v) => {
            const u = v.toUpperCase();
            return u === StorageDriverType.GITHUB || u === StorageDriverType.S3 ? u : StorageDriverType.LOCAL;
        },
    },
    "storagePrivate.github.owner": {
        key: "storage_private.github.owner",
        env: "GITHUB_PRIVATE_OWNER",
        default: "lsx-xyg",
    },
    "storagePrivate.github.repo": {
        key: "storage_private.github.repo",
        env: "GITHUB_PRIVATE_REPO",
        default: "backups",
    },
    "storagePrivate.github.branch": {
        key: "storage_private.github.branch",
        env: "GITHUB_PRIVATE_BRANCH",
        default: "main",
    },
    "storagePrivate.github.cdnBase": {
        key: "storage_private.github.cdn_base",
        env: "GITHUB_PRIVATE_CDN_BASE",
        default: "https://cdn.jsdelivr.net/gh",
    },
    "storagePrivate.github.directory": {
        key: "storage_private.github.directory",
        env: "GITHUB_PRIVATE_DIRECTORY",
        default: "backups",
    },
    "storagePrivate.github.token": {
        key: "storage_private.github.token",
        env: "GITHUB_PRIVATE_TOKEN",
        default: "",
        secret: true,
    },
    "storagePrivate.s3.endpoint": {
        key: "storage_private.s3.endpoint",
        env: "S3_PRIVATE_ENDPOINT",
        default: "",
    },
    "storagePrivate.s3.bucket": {
        key: "storage_private.s3.bucket",
        env: "S3_PRIVATE_BUCKET",
        default: "",
    },
    "storagePrivate.s3.region": {
        key: "storage_private.s3.region",
        env: "S3_PRIVATE_REGION",
        default: "auto",
    },
    "storagePrivate.s3.directory": {
        key: "storage_private.s3.directory",
        env: "S3_PRIVATE_DIRECTORY",
        default: "backups",
    },
    "storagePrivate.s3.accessKey": {
        key: "storage_private.s3.access_key",
        env: "S3_PRIVATE_ACCESS_KEY",
        default: "",
        secret: true,
    },
    "storagePrivate.s3.secretKey": {
        key: "storage_private.s3.secret_key",
        env: "S3_PRIVATE_SECRET_KEY",
        default: "",
        secret: true,
    },
    "storagePrivate.local.uploadDir": {
        key: "storage_private.local.upload_dir",
        env: "LOCAL_PRIVATE_DIR",
        default: "private/storage",
    },
    "storagePrivate.local.directory": {
        key: "storage_private.local.directory",
        env: "LOCAL_PRIVATE_SUBDIRECTORY",
        default: "backups",
    },
} satisfies Record<string, ConfigDef<any>>;

/** registry 的语义化键联合类型 */
export type RegistryKey = keyof typeof registry;

