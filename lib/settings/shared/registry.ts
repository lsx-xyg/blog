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
 * - 存储：**取驱动走通道** `getStorageDriver(channel)`（档案池 storage_profiles +
 *   `storage.binding.*` 绑定）；下面 storage.* / storagePrivate.* 是**旧版**两组配置，
 *   仅在「档案未播种 / 通道未绑定」时作为回退，后台已不再直接编辑（改在 /{adminSlug}/storage）
 * - storage.driver      → storage.driver（归一化为 LOCAL/GITHUB/S3/WEBDAV）
 *                         [env: STORAGE_DRIVER]
 * - storage.github.owner / repo / branch / directory → storage.github.*
 *                         [env: GITHUB_STORAGE_OWNER / _REPO / _BRANCH / _DIRECTORY]
 * - storage.github.cdnBase  → storage.github.cdn_base（默认 raw.githubusercontent.com 直连）
 *                         [env: GITHUB_STORAGE_CDN_BASE]
 * - storage.github.urlStyle → storage.github.url_style
 *                         （path = /{branch}/ 普通路径；at = @{branch} jsDelivr 格式）
 *                         [env: GITHUB_STORAGE_URL_STYLE]
 * - storage.github.token    → storage.github.token（敏感，AES-256-GCM）
 *                         [env: GITHUB_STORAGE_TOKEN]
 * - storage.s3.endpoint / publicBase / bucket / region / directory → storage.s3.*
 *                         [env: S3_ENDPOINT / S3_PUBLIC_BASE / S3_BUCKET / S3_REGION / S3_DIRECTORY]
 * - storage.s3.accessKey / secretKey → storage.s3.*（敏感，AES-256-GCM）
 *                         [env: S3_ACCESS_KEY / S3_SECRET_KEY]
 * - storage.local.uploadDir / directory → storage.local.*
 *                         [env: LOCAL_UPLOAD_DIR / LOCAL_STORAGE_DIRECTORY]
 * - storage.webdav.url / username / password / directory → storage.webdav.*
 *                         [env: WEBDAV_URL / WEBDAV_USERNAME / WEBDAV_PASSWORD / WEBDAV_DIRECTORY]
 * - storage.binding.upload / gallery / backup → 通道绑定的档案名（storage_profiles.name，空 = 未绑定）
 *                         [env: STORAGE_BINDING_UPLOAD / _GALLERY / _BACKUP]
 * - storagePrivate.*    → 旧版私有存储（与公开组同构，DB key 前缀 storage_private.*）
 *                         [env: STORAGE_PRIVATE_DRIVER / GITHUB_PRIVATE_* / S3_PRIVATE_* /
 *                          LOCAL_PRIVATE_DIR / LOCAL_PRIVATE_SUBDIRECTORY / WEBDAV_PRIVATE_*]
 * - backup.retentionDays / retentionCount → 备份保留策略（0 = 不限制，超限即清理，至少保留最新一份）
 *                         [env: BACKUP_RETENTION_DAYS / BACKUP_RETENTION_COUNT]
 *
 * 优先级统一为：env > DB > default（仅 getConfig 一处合并）。
 */

import { StorageDriverType, GithubUrlStyle } from '@/lib/types/storage';
import { CronDeployPlatform } from '@/lib/types/settings';

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

/**
 * 保留策略数值归一化：非法值 / 负数 / 小数 → 0（0 表示不限制）。
 * 上限只做防呆，避免误填天文数字把清理逻辑变成死代码。
 */
function toRetentionValue(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 10000);
}

export const registry = {
  'site.name': {
    key: 'site.name',
    default: '林圣轩blog',
  },
  'site.description': {
    key: 'site.description',
    default: '技术写作与生活记录',
  },
  'site.seoDescription': {
    key: 'site.seo_description',
    default: '林圣轩的个人博客，分享技术写作与生活记录',
  },
  'site.logoUrl': {
    key: 'site.logo_url',
    default: '',
  },
  'site.faviconUrl': {
    key: 'site.favicon_url',
    default: '',
  },
  'site.siteUrl': {
    key: 'site.site_url',
    env: 'NEXT_PUBLIC_SITE_URL',
    default: '',
  },
  'social.github': {
    key: 'social.github',
    default: '',
  },
  'social.twitter': {
    key: 'social.twitter',
    default: '',
  },
  'social.email': {
    key: 'social.email',
    default: '',
  },
  'social.rss': {
    key: 'social.rss',
    default: '/rss.xml',
  },
  'footer.copyright': {
    key: 'footer.copyright',
    default: '',
  },
  'footer.icp': {
    key: 'footer.icp',
    default: '',
  },
  'about.content': {
    key: 'about.content',
    default: '## 关于我\n\n这里是关于页面的内容，可以在后台设置中编辑。',
  },
  'giscus.repo': {
    key: 'giscus.repo',
    env: 'NEXT_PUBLIC_GISCUS_REPO',
    default: '',
  },
  'giscus.repoId': {
    key: 'giscus.repo_id',
    env: 'NEXT_PUBLIC_GISCUS_REPO_ID',
    default: '',
  },
  'giscus.category': {
    key: 'giscus.category',
    env: 'NEXT_PUBLIC_GISCUS_CATEGORY',
    default: 'Announcements',
  },
  'giscus.categoryId': {
    key: 'giscus.category_id',
    env: 'NEXT_PUBLIC_GISCUS_CATEGORY_ID',
    default: '',
  },
  'giscus.enabled': {
    key: 'giscus.enabled',
    default: true,
    transform: (v) => v === 'true' || v === '1',
  },
  'cron.deployPlatform': {
    key: 'cron.deploy_platform',
    env: 'DEPLOY_PLATFORM',
    default: CronDeployPlatform.VERCEL,
    transform: (v) =>
      v.toUpperCase() === 'SERVER' ? CronDeployPlatform.SERVER : CronDeployPlatform.VERCEL,
  },
  'cron.secret': {
    key: 'cron.secret',
    env: 'CRON_SECRET',
    default: '',
    secret: true,
  },
  'cron.jobApiKey': {
    key: 'cron.job_api_key',
    env: 'CRON_JOB_API_KEY',
    default: '',
    secret: true,
  },
  'storage.driver': {
    key: 'storage.driver',
    env: 'STORAGE_DRIVER',
    default: StorageDriverType.LOCAL,
    // 归一化：任何非 GITHUB/S3/WEBDAV（忽略大小写）的值都落到 LOCAL
    transform: (v) => {
      const u = v.toUpperCase();
      return u === StorageDriverType.GITHUB ||
        u === StorageDriverType.S3 ||
        u === StorageDriverType.WEBDAV
        ? u
        : StorageDriverType.LOCAL;
    },
  },
  'storage.github.owner': {
    key: 'storage.github.owner',
    env: 'GITHUB_STORAGE_OWNER',
    default: 'lsx-xyg',
  },
  'storage.github.repo': {
    key: 'storage.github.repo',
    env: 'GITHUB_STORAGE_REPO',
    default: 'public',
  },
  'storage.github.branch': {
    key: 'storage.github.branch',
    env: 'GITHUB_STORAGE_BRANCH',
    default: 'main',
  },
  'storage.github.cdnBase': {
    key: 'storage.github.cdn_base',
    env: 'GITHUB_STORAGE_CDN_BASE',
    default: 'https://raw.githubusercontent.com',
  },
  'storage.github.urlStyle': {
    key: 'storage.github.url_style',
    env: 'GITHUB_STORAGE_URL_STYLE',
    default: GithubUrlStyle.PATH,
    // 归一化：仅 'at' 视为 jsDelivr 拼接格式，其余一律落到普通路径格式
    transform: (v) =>
      v.toLowerCase() === GithubUrlStyle.AT ? GithubUrlStyle.AT : GithubUrlStyle.PATH,
  },
  'storage.github.directory': {
    key: 'storage.github.directory',
    env: 'GITHUB_STORAGE_DIRECTORY',
    default: '',
  },
  'storage.github.token': {
    key: 'storage.github.token',
    env: 'GITHUB_STORAGE_TOKEN',
    default: '',
    secret: true,
  },
  'storage.s3.endpoint': {
    key: 'storage.s3.endpoint',
    env: 'S3_ENDPOINT',
    default: '',
  },
  'storage.s3.publicBase': {
    key: 'storage.s3.public_base',
    env: 'S3_PUBLIC_BASE',
    default: '',
  },
  'storage.s3.bucket': {
    key: 'storage.s3.bucket',
    env: 'S3_BUCKET',
    default: '',
  },
  'storage.s3.region': {
    key: 'storage.s3.region',
    env: 'S3_REGION',
    default: 'auto',
  },
  'storage.s3.directory': {
    key: 'storage.s3.directory',
    env: 'S3_DIRECTORY',
    default: '',
  },
  'storage.s3.accessKey': {
    key: 'storage.s3.access_key',
    env: 'S3_ACCESS_KEY',
    default: '',
    secret: true,
  },
  'storage.s3.secretKey': {
    key: 'storage.s3.secret_key',
    env: 'S3_SECRET_KEY',
    default: '',
    secret: true,
  },
  'storage.local.uploadDir': {
    key: 'storage.local.upload_dir',
    env: 'LOCAL_UPLOAD_DIR',
    default: 'public/uploads',
  },
  'storage.local.directory': {
    key: 'storage.local.directory',
    env: 'LOCAL_STORAGE_DIRECTORY',
    default: '',
  },
  'storage.webdav.url': {
    key: 'storage.webdav.url',
    env: 'WEBDAV_URL',
    default: '',
  },
  'storage.webdav.username': {
    key: 'storage.webdav.username',
    env: 'WEBDAV_USERNAME',
    default: '',
  },
  'storage.webdav.password': {
    key: 'storage.webdav.password',
    env: 'WEBDAV_PASSWORD',
    default: '',
    secret: true,
  },
  'storage.webdav.directory': {
    key: 'storage.webdav.directory',
    env: 'WEBDAV_DIRECTORY',
    default: '',
  },
  // === 存储通道绑定（channel → storage_profiles.name）===
  // 空值表示未绑定，factory 回退到旧版公开/私有配置行为
  'storage.binding.upload': {
    key: 'storage.binding.upload',
    env: 'STORAGE_BINDING_UPLOAD',
    default: '',
  },
  'storage.binding.gallery': {
    key: 'storage.binding.gallery',
    env: 'STORAGE_BINDING_GALLERY',
    default: '',
  },
  'storage.binding.backup': {
    key: 'storage.binding.backup',
    env: 'STORAGE_BINDING_BACKUP',
    default: '',
  },
  // === 私有存储配置（用于备份等敏感数据）===
  'storagePrivate.driver': {
    key: 'storage_private.driver',
    env: 'STORAGE_PRIVATE_DRIVER',
    default: StorageDriverType.LOCAL,
    transform: (v) => {
      const u = v.toUpperCase();
      return u === StorageDriverType.GITHUB ||
        u === StorageDriverType.S3 ||
        u === StorageDriverType.WEBDAV
        ? u
        : StorageDriverType.LOCAL;
    },
  },
  'storagePrivate.github.owner': {
    key: 'storage_private.github.owner',
    env: 'GITHUB_PRIVATE_OWNER',
    default: 'lsx-xyg',
  },
  'storagePrivate.github.repo': {
    key: 'storage_private.github.repo',
    env: 'GITHUB_PRIVATE_REPO',
    default: 'backups',
  },
  'storagePrivate.github.branch': {
    key: 'storage_private.github.branch',
    env: 'GITHUB_PRIVATE_BRANCH',
    default: 'main',
  },
  'storagePrivate.github.cdnBase': {
    key: 'storage_private.github.cdn_base',
    env: 'GITHUB_PRIVATE_CDN_BASE',
    default: 'https://raw.githubusercontent.com',
  },
  'storagePrivate.github.urlStyle': {
    key: 'storage_private.github.url_style',
    env: 'GITHUB_PRIVATE_URL_STYLE',
    default: GithubUrlStyle.PATH,
    transform: (v) =>
      v.toLowerCase() === GithubUrlStyle.AT ? GithubUrlStyle.AT : GithubUrlStyle.PATH,
  },
  'storagePrivate.github.directory': {
    key: 'storage_private.github.directory',
    env: 'GITHUB_PRIVATE_DIRECTORY',
    default: 'backups',
  },
  'storagePrivate.github.token': {
    key: 'storage_private.github.token',
    env: 'GITHUB_PRIVATE_TOKEN',
    default: '',
    secret: true,
  },
  'storagePrivate.s3.endpoint': {
    key: 'storage_private.s3.endpoint',
    env: 'S3_PRIVATE_ENDPOINT',
    default: '',
  },
  'storagePrivate.s3.publicBase': {
    key: 'storage_private.s3.public_base',
    env: 'S3_PRIVATE_PUBLIC_BASE',
    default: '',
  },
  'storagePrivate.s3.bucket': {
    key: 'storage_private.s3.bucket',
    env: 'S3_PRIVATE_BUCKET',
    default: '',
  },
  'storagePrivate.s3.region': {
    key: 'storage_private.s3.region',
    env: 'S3_PRIVATE_REGION',
    default: 'auto',
  },
  'storagePrivate.s3.directory': {
    key: 'storage_private.s3.directory',
    env: 'S3_PRIVATE_DIRECTORY',
    default: 'backups',
  },
  'storagePrivate.s3.accessKey': {
    key: 'storage_private.s3.access_key',
    env: 'S3_PRIVATE_ACCESS_KEY',
    default: '',
    secret: true,
  },
  'storagePrivate.s3.secretKey': {
    key: 'storage_private.s3.secret_key',
    env: 'S3_PRIVATE_SECRET_KEY',
    default: '',
    secret: true,
  },
  'storagePrivate.local.uploadDir': {
    key: 'storage_private.local.upload_dir',
    env: 'LOCAL_PRIVATE_DIR',
    default: 'private/storage',
  },
  'storagePrivate.local.directory': {
    key: 'storage_private.local.directory',
    env: 'LOCAL_PRIVATE_SUBDIRECTORY',
    default: 'backups',
  },
  'storagePrivate.webdav.url': {
    key: 'storage_private.webdav.url',
    env: 'WEBDAV_PRIVATE_URL',
    default: '',
  },
  'storagePrivate.webdav.username': {
    key: 'storage_private.webdav.username',
    env: 'WEBDAV_PRIVATE_USERNAME',
    default: '',
  },
  'storagePrivate.webdav.password': {
    key: 'storage_private.webdav.password',
    env: 'WEBDAV_PRIVATE_PASSWORD',
    default: '',
    secret: true,
  },
  'storagePrivate.webdav.directory': {
    key: 'storage_private.webdav.directory',
    env: 'WEBDAV_PRIVATE_DIRECTORY',
    default: 'backups',
  },
  // === 备份保留策略（自动清理旧备份，0 = 不限制）===
  // 两项任一超限即删除：超过 N 天的，或条数排在第 M 位之后的
  'backup.retentionDays': {
    key: 'backup.retention_days',
    env: 'BACKUP_RETENTION_DAYS',
    default: 0,
    transform: toRetentionValue,
  },
  'backup.retentionCount': {
    key: 'backup.retention_count',
    env: 'BACKUP_RETENTION_COUNT',
    default: 0,
    transform: toRetentionValue,
  },
} satisfies Record<string, ConfigDef<any>>;

/** registry 的语义化键联合类型 */
export type RegistryKey = keyof typeof registry;
