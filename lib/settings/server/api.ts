/**
 * 站点设置服务层（C9：settings 路由薄壳化）。
 *
 * 路由层不再持有领域知识：
 * - GET  → getSettingsBundle()：聚合读取 + 敏感字段裁剪（只出 configured 布尔）
 * - PUT  → applySettingsPatch()：字段分类（普通/敏感/可选文本）→ 加密 → 批量 upsert/删除
 *
 * 纯函数（buildSettingsOps / to*ForClient）可独立单测，加密函数注入便于测试。
 */
import { getSetting, setSettingsBatch, deleteSetting } from './store';
import {
  getSiteSettings,
  getSocialLinks,
  getFooterSettings,
  getAboutContent,
  setAboutContent,
  getGiscusSettings,
  getCronSettings,
  getStorageSettings,
  getPrivateStorageSettings,
} from './settings';
import { encryptIfAvailable } from '@/lib/crypto/server';
import { CronDeployPlatform } from '@/lib/types/settings';
import type { CronSettings, PrivateStorageSettings, StorageSettings } from '@/lib/types/settings';
import { STORAGE_DRIVER_VALUES } from '@/lib/types/storage';

/* ---------------- GET：敏感字段裁剪（纯） ---------------- */

/** 存储配置 → 客户端视图（token/accessKey/secretKey 只出 configured 布尔） */
export function toStorageForClient(storage: StorageSettings): ReturnType<typeof shapeStorage> {
  return shapeStorage(storage);
}

/** 私有存储配置 → 客户端视图（结构与公开存储一致） */
export function toPrivateStorageForClient(
  storage: PrivateStorageSettings,
): ReturnType<typeof shapeStorage> {
  return shapeStorage(storage);
}

function shapeStorage(storage: StorageSettings) {
  return {
    driver: storage.driver,
    github: {
      owner: storage.github.owner,
      repo: storage.github.repo,
      branch: storage.github.branch,
      cdnBase: storage.github.cdnBase,
      urlStyle: storage.github.urlStyle,
      directory: storage.github.directory,
      tokenConfigured: !!storage.github.token,
    },
    s3: {
      endpoint: storage.s3.endpoint,
      bucket: storage.s3.bucket,
      region: storage.s3.region,
      directory: storage.s3.directory,
      accessKeyConfigured: !!storage.s3.accessKey,
      secretKeyConfigured: !!storage.s3.secretKey,
    },
    local: {
      uploadDir: storage.local.uploadDir,
      directory: storage.local.directory,
    },
  };
}

/** 定时任务配置 → 客户端视图（secret/jobApiKey 只出 configured 布尔） */
export function toCronForClient(cron: CronSettings) {
  return {
    deployPlatform: cron.deployPlatform,
    secretConfigured: !!cron.secret,
    jobApiKeyConfigured: !!cron.jobApiKey,
  };
}

/** GET 聚合：一次读全量设置并裁剪敏感字段（route 直接返回此结果） */
export async function getSettingsBundle() {
  const [site, social, footer, aboutContent, adminPath, storage, privateStorage, giscus, cron] =
    await Promise.all([
      getSiteSettings(),
      getSocialLinks(),
      getFooterSettings(),
      getAboutContent(),
      getSetting<string>('admin.path'),
      getStorageSettings(),
      getPrivateStorageSettings(),
      getGiscusSettings(),
      getCronSettings(),
    ]);

  return {
    site,
    social,
    footer,
    aboutContent,
    adminPath: adminPath ?? '',
    storage: toStorageForClient(storage),
    privateStorage: toPrivateStorageForClient(privateStorage),
    giscus,
    cron: toCronForClient(cron),
  };
}

/* ---------------- PUT：字段分类 + 加密编排（纯，encrypt 注入） ---------------- */

export type SettingsUpdate = { key: string; value: unknown };

export type SettingsOps = {
  update: SettingsUpdate[];
  delete: string[];
  aboutContent?: string;
};

/** 加密函数签名（默认 encryptIfAvailable，测试注入 mock） */
export type SettingsEncrypt = (value: string) => string | null;

/**
 * 把设置补丁翻译成「更新/删除操作」列表。
 *
 * 三分支规则：
 * - 普通字段：undefined/null 跳过，其余原样存
 * - 敏感字段（handleSecret）：undefined/null 跳过（保持原值），"" 删除（回退环境变量），其余加密存
 * - 可选文本（handleOptionalText）：undefined/null 跳过，"" 删除，其余原样存
 */
export function buildSettingsOps(
  body: Record<string, unknown>,
  encrypt: SettingsEncrypt = encryptIfAvailable,
): SettingsOps {
  const update: SettingsUpdate[] = [];
  const del: string[] = [];
  const ops: SettingsOps = { update, delete: del };

  const addSetting = (key: string, value: unknown) => {
    if (value !== undefined && value !== null) {
      update.push({ key, value });
    }
  };
  const handleSecret = (rawValue: unknown, dbKey: string) => {
    if (rawValue === undefined || rawValue === null) return;
    if (rawValue === '') {
      del.push(dbKey);
      return;
    }
    if (typeof rawValue !== 'string') return;
    const encrypted = encrypt(rawValue);
    if (encrypted) update.push({ key: dbKey, value: encrypted });
  };
  const handleOptionalText = (rawValue: unknown, dbKey: string) => {
    if (rawValue === undefined || rawValue === null) return;
    if (rawValue === '') {
      del.push(dbKey);
      return;
    }
    update.push({ key: dbKey, value: rawValue });
  };

  const site = body.site as Record<string, unknown> | undefined;
  if (site) {
    addSetting('site.name', site.name);
    addSetting('site.description', site.description);
    addSetting('site.seo_description', site.seoDescription);
    addSetting('site.logo_url', site.logoUrl);
    addSetting('site.favicon_url', site.faviconUrl);
    addSetting('site.site_url', site.siteUrl);
  }

  const social = body.social as Record<string, unknown> | undefined;
  if (social) {
    addSetting('social.github', social.github);
    addSetting('social.twitter', social.twitter);
    addSetting('social.email', social.email);
    addSetting('social.rss', social.rss);
  }

  const footer = body.footer as Record<string, unknown> | undefined;
  if (footer) {
    addSetting('footer.copyright', footer.copyright);
    addSetting('footer.icp', footer.icp);
  }

  // 高级设置（admin_path）：有值更新，放空删除（回退环境变量/兜底 admin）
  handleOptionalText(body.adminPath, 'admin.path');

  const storage = body.storage as Record<string, unknown> | undefined;
  if (storage) {
    const { driver, github, s3, local } = storage as {
      driver?: unknown;
      github?: Record<string, unknown>;
      s3?: Record<string, unknown>;
      local?: Record<string, unknown>;
    };
    if (driver && (STORAGE_DRIVER_VALUES as string[]).includes((driver as string).toUpperCase())) {
      addSetting('storage.driver', (driver as string).toUpperCase());
    }
    if (github) {
      addSetting('storage.github.owner', github.owner);
      addSetting('storage.github.repo', github.repo);
      addSetting('storage.github.branch', github.branch);
      addSetting('storage.github.cdn_base', github.cdnBase);
      addSetting('storage.github.url_style', github.urlStyle);
      addSetting('storage.github.directory', github.directory);
      handleSecret(github.token, 'storage.github.token');
    }
    if (s3) {
      addSetting('storage.s3.endpoint', s3.endpoint);
      addSetting('storage.s3.bucket', s3.bucket);
      addSetting('storage.s3.region', s3.region);
      addSetting('storage.s3.directory', s3.directory);
      handleSecret(s3.accessKey, 'storage.s3.access_key');
      handleSecret(s3.secretKey, 'storage.s3.secret_key');
    }
    if (local) {
      addSetting('storage.local.upload_dir', local.uploadDir);
      addSetting('storage.local.directory', local.directory);
    }
  }

  const privateStorage = body.privateStorage as Record<string, unknown> | undefined;
  if (privateStorage) {
    const { driver, github, s3, local } = privateStorage as {
      driver?: unknown;
      github?: Record<string, unknown>;
      s3?: Record<string, unknown>;
      local?: Record<string, unknown>;
    };
    if (driver && (STORAGE_DRIVER_VALUES as string[]).includes((driver as string).toUpperCase())) {
      addSetting('storage_private.driver', (driver as string).toUpperCase());
    }
    if (github) {
      addSetting('storage_private.github.owner', github.owner);
      addSetting('storage_private.github.repo', github.repo);
      addSetting('storage_private.github.branch', github.branch);
      addSetting('storage_private.github.cdn_base', github.cdnBase);
      addSetting('storage_private.github.url_style', github.urlStyle);
      addSetting('storage_private.github.directory', github.directory);
      handleSecret(github.token, 'storage_private.github.token');
    }
    if (s3) {
      addSetting('storage_private.s3.endpoint', s3.endpoint);
      addSetting('storage_private.s3.bucket', s3.bucket);
      addSetting('storage_private.s3.region', s3.region);
      addSetting('storage_private.s3.directory', s3.directory);
      handleSecret(s3.accessKey, 'storage_private.s3.access_key');
      handleSecret(s3.secretKey, 'storage_private.s3.secret_key');
    }
    if (local) {
      addSetting('storage_private.local.upload_dir', local.uploadDir);
      addSetting('storage_private.local.directory', local.directory);
    }
  }

  const giscus = body.giscus as Record<string, unknown> | undefined;
  if (giscus) {
    const { repo, repoId, category, categoryId, enabled } = giscus as Record<string, unknown>;
    if (repo !== undefined) addSetting('giscus.repo', repo);
    if (repoId !== undefined) addSetting('giscus.repo_id', repoId);
    if (category !== undefined) addSetting('giscus.category', category);
    if (categoryId !== undefined) addSetting('giscus.category_id', categoryId);
    if (enabled !== undefined) {
      addSetting('giscus.enabled', enabled ? 'true' : 'false');
    }
  }

  const cron = body.cron as Record<string, unknown> | undefined;
  if (cron) {
    const { deployPlatform, secret, jobApiKey } = cron as Record<string, unknown>;
    if (deployPlatform !== undefined && deployPlatform !== null) {
      const normalized =
        (deployPlatform as string).toUpperCase() === 'SERVER'
          ? CronDeployPlatform.SERVER
          : CronDeployPlatform.VERCEL;
      addSetting('cron.deploy_platform', normalized);
    }
    handleSecret(secret, 'cron.secret');
    handleSecret(jobApiKey, 'cron.job_api_key');
  }

  const aboutContent = body.aboutContent;
  if (aboutContent !== undefined) {
    ops.aboutContent = aboutContent as string;
  }

  return ops;
}

/** PUT 聚合：执行补丁（批量 upsert + 删除 + 关于内容） */
export async function applySettingsPatch(body: Record<string, unknown>): Promise<void> {
  const ops = buildSettingsOps(body);
  if (ops.update.length > 0) {
    await setSettingsBatch(ops.update);
  }
  for (const key of ops.delete) {
    await deleteSetting(key);
  }
  if (ops.aboutContent !== undefined) {
    await setAboutContent(ops.aboutContent);
  }
}
