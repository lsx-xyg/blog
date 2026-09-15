import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/shared/utils";
import {
  setSettingsBatch,
  getSetting,
  deleteSetting,
} from "@/lib/settings";
import {
  getSiteSettings,
  getSocialLinks,
  getFooterSettings,
  getAboutContent, setAboutContent, getGiscusSettings,
  getCronSettings,
  getStorageSettings,
  getPrivateStorageSettings
} from "@/lib/settings/index";
import { encryptIfAvailable } from "@/lib/shared/crypto";
import { CronDeployPlatform } from "@/lib/types/settings";
import { STORAGE_DRIVER_VALUES } from "@/lib/storage";

/**
 * 站点设置 API
 * GET /api/admin/settings - 获取所有设置（站点信息+社交链接+页脚+关于内容）
 * PUT /api/admin/settings - 批量更新设置
 */

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const [site, social, footer, aboutContent, adminPath, storage, privateStorage, giscus, cron] = await Promise.all([
      getSiteSettings(),
      getSocialLinks(),
      getFooterSettings(),
      getAboutContent(),
      getSetting<string>("admin.path"),
      getStorageSettings(),
      getPrivateStorageSettings(),
      getGiscusSettings(),
      getCronSettings(),
    ]);

    // 敏感信息不返回明文，只返回是否已配置（布尔值）
    const storageForClient = {
      driver: storage.driver,
      github: {
        owner: storage.github.owner,
        repo: storage.github.repo,
        branch: storage.github.branch,
        cdnBase: storage.github.cdnBase,
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

    // 私有存储配置（用于备份等敏感数据，敏感信息不返回明文）
    const privateStorageForClient = {
      driver: privateStorage.driver,
      github: {
        owner: privateStorage.github.owner,
        repo: privateStorage.github.repo,
        branch: privateStorage.github.branch,
        cdnBase: privateStorage.github.cdnBase,
        directory: privateStorage.github.directory,
        tokenConfigured: !!privateStorage.github.token,
      },
      s3: {
        endpoint: privateStorage.s3.endpoint,
        bucket: privateStorage.s3.bucket,
        region: privateStorage.s3.region,
        directory: privateStorage.s3.directory,
        accessKeyConfigured: !!privateStorage.s3.accessKey,
        secretKeyConfigured: !!privateStorage.s3.secretKey,
      },
      local: {
        uploadDir: privateStorage.local.uploadDir,
        directory: privateStorage.local.directory,
      },
    };

    // 定时任务配置（敏感信息不返回明文，只返回是否已配置）
    const cronForClient = {
      deployPlatform: cron.deployPlatform,
      secretConfigured: !!cron.secret,
      jobApiKeyConfigured: !!cron.jobApiKey,
    };

    return NextResponse.json({
      site,
      social,
      footer,
      aboutContent,
      adminPath: adminPath ?? "",
      storage: storageForClient,
      privateStorage: privateStorageForClient,
      giscus,
      cron: cronForClient,
    });
  } catch (error) {
    console.error("获取设置失败：", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { site, social, footer, aboutContent } = body;

    // 需要更新的设置
    const settingsToUpdate: { key: string; value: unknown }[] = [];
  
    // 需要删除的设置
    const settingsToDelete: string[] = [];

    // 非敏感字段：undefined/null 跳过，其余原样存
    const addSetting = (key: string, value: unknown) => {
      if (value !== undefined && value !== null) {
        settingsToUpdate.push({ key, value });
      }
    };

    // 敏感字段：undefined/null 跳过（保持原值），"" 删除（回退环境变量），其余加密存
    const handleSecret = (rawValue: unknown, dbKey: string) => {
      if (rawValue === undefined || rawValue === null) return;
      if (rawValue === "") {
        settingsToDelete.push(dbKey);
        return;
      }
      if (typeof rawValue !== "string") return;
      const encrypted = encryptIfAvailable(rawValue);
      if (encrypted) settingsToUpdate.push({ key: dbKey, value: encrypted });
    };

    // 可选文本：undefined/null 跳过，"" 删除，其余原样存
    const handleOptionalText = (rawValue: unknown, dbKey: string) => {
      if (rawValue === undefined || rawValue === null) return;
      if (rawValue === "") {
        settingsToDelete.push(dbKey);
        return;
      }
      settingsToUpdate.push({ key: dbKey, value: rawValue });
    };

    // 站点设置
    if (site) {
      addSetting("site.name", site.name);
      addSetting("site.description", site.description);
      addSetting("site.seo_description", site.seoDescription);
      addSetting("site.logo_url", site.logoUrl);
      addSetting("site.favicon_url", site.faviconUrl);
      addSetting("site.site_url", site.siteUrl);
    }

    // 社交链接
    if (social) {
      addSetting("social.github", social.github);
      addSetting("social.twitter", social.twitter);
      addSetting("social.email", social.email);
      addSetting("social.rss", social.rss);
    }

    // 页脚设置
    if (footer) {
      addSetting("footer.copyright", footer.copyright);
      addSetting("footer.icp", footer.icp);
    }

    // 高级设置（admin_path）
    // 有值则更新，放空则删除记录（回退到环境变量/兜底 admin）
    handleOptionalText(body.adminPath, "admin.path");

    if (body.storage) {
      const { driver, github, s3, local } = body.storage;
      if (driver && STORAGE_DRIVER_VALUES.includes(driver.toUpperCase())) {
        addSetting("storage.driver", driver.toUpperCase());
      }
      if (github) {
        addSetting("storage.github.owner", github.owner);
        addSetting("storage.github.repo", github.repo);
        addSetting("storage.github.branch", github.branch);
        addSetting("storage.github.cdn_base", github.cdnBase);
        addSetting("storage.github.directory", github.directory);
        // 敏感信息：Token 加密后存储，放空时删除记录
        handleSecret(github.token, "storage.github.token");
      }
      if (s3) {
        addSetting("storage.s3.endpoint", s3.endpoint);
        addSetting("storage.s3.bucket", s3.bucket);
        addSetting("storage.s3.region", s3.region);
        addSetting("storage.s3.directory", s3.directory);
        // 敏感信息：Access Key 加密后存储，放空时删除记录
        handleSecret(s3.accessKey, "storage.s3.access_key");
        // 敏感信息：Secret Key 加密后存储，放空时删除记录
        handleSecret(s3.secretKey, "storage.s3.secret_key");
      }
      if (local) {
        addSetting("storage.local.upload_dir", local.uploadDir);
        addSetting("storage.local.directory", local.directory);
      }
    }

    // 私有存储配置（用于备份等敏感数据）
    if (body.privateStorage) {
      const { driver, github, s3, local } = body.privateStorage;
      if (driver && STORAGE_DRIVER_VALUES.includes(driver.toUpperCase())) {
        addSetting("storage_private.driver", driver.toUpperCase());
      }
      if (github) {
        addSetting("storage_private.github.owner", github.owner);
        addSetting("storage_private.github.repo", github.repo);
        addSetting("storage_private.github.branch", github.branch);
        addSetting("storage_private.github.cdn_base", github.cdnBase);
        addSetting("storage_private.github.directory", github.directory);
        handleSecret(github.token, "storage_private.github.token");
      }
      if (s3) {
        addSetting("storage_private.s3.endpoint", s3.endpoint);
        addSetting("storage_private.s3.bucket", s3.bucket);
        addSetting("storage_private.s3.region", s3.region);
        addSetting("storage_private.s3.directory", s3.directory);
        handleSecret(s3.accessKey, "storage_private.s3.access_key");
        handleSecret(s3.secretKey, "storage_private.s3.secret_key");
      }
      if (local) {
        addSetting("storage_private.local.upload_dir", local.uploadDir);
        addSetting("storage_private.local.directory", local.directory);
      }
    }

    // giscus 评论配置（非敏感信息，直接存）
    if (body.giscus) {
      const { repo, repoId, category, categoryId } = body.giscus;
      if (repo !== undefined) addSetting("giscus.repo", repo);
      if (repoId !== undefined) addSetting("giscus.repo_id", repoId);
      if (category !== undefined) addSetting("giscus.category", category);
      if (categoryId !== undefined) addSetting("giscus.category_id", categoryId);
    }

    // 定时任务配置
    if (body.cron) {
      const { deployPlatform, secret, jobApiKey } = body.cron;
      // DEPLOY_PLATFORM：非敏感信息，直接存
      if (deployPlatform !== undefined && deployPlatform !== null) {
        const normalized = deployPlatform.toUpperCase() === "SERVER" ? CronDeployPlatform.SERVER
          : CronDeployPlatform.VERCEL;
        addSetting("cron.deploy_platform", normalized);
      }
      // 敏感信息：Cron Secret 加密后存储，放空时删除记录
      handleSecret(secret, "cron.secret");
      // CRON_JOB_API_KEY：敏感信息，加密存储；放空时删除（回退环境变量）
      handleSecret(jobApiKey, "cron.job_api_key");
    }

    // 批量更新设置
    if (settingsToUpdate.length > 0) {
      await setSettingsBatch(settingsToUpdate);
    }

    for (const key of settingsToDelete) {
      await deleteSetting(key);
    }

    // 关于内容
    if (aboutContent !== undefined) {
      await setAboutContent(aboutContent);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新设置失败：", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
