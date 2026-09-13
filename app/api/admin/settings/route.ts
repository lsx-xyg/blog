import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import {
  getSiteSettings,
  getSocialLinks,
  getFooterSettings,
  getAboutContent,
  setSettingsBatch,
  setAboutContent,
  getSetting,
  deleteSetting,
} from "@/lib/settings";
import { getStorageConfig } from "@/lib/storage";
import { encryptIfAvailable } from "@/lib/crypto";

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
    const [site, social, footer, aboutContent, adminPath, storage] = await Promise.all([
      getSiteSettings(),
      getSocialLinks(),
      getFooterSettings(),
      getAboutContent(),
      getSetting<string>("admin.path"),
      getStorageConfig(),
    ]);

    // 敏感信息不返回明文，只返回是否已配置（布尔值）
    const storageForClient = {
      driver: storage.driver,
      github: {
        owner: storage.github.owner,
        repo: storage.github.repo,
        branch: storage.github.branch,
        cdnBase: storage.github.cdnBase,
        tokenConfigured: !!storage.github.token,
      },
      s3: {
        endpoint: storage.s3.endpoint,
        bucket: storage.s3.bucket,
        region: storage.s3.region,
        accessKeyConfigured: !!storage.s3.accessKey,
        secretKeyConfigured: !!storage.s3.secretKey,
      },
      local: {
        uploadDir: storage.local.uploadDir,
      },
    };

    return NextResponse.json({
      site,
      social,
      footer,
      aboutContent,
      adminPath: adminPath ?? "",
      storage: storageForClient,
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

    const settingsToUpdate: { key: string; value: unknown }[] = [];

    // 辅助函数：只添加非 null 的值
    const addSetting = (key: string, value: unknown) => {
      if (value !== undefined && value !== null) {
        settingsToUpdate.push({ key, value });
      }
    };

    // 站点设置
    if (site) {
      addSetting("site.name", site.name);
      addSetting("site.description", site.description);
      addSetting("site.seo_description", site.seoDescription);
      addSetting("site.logo_url", site.logoUrl);
      addSetting("site.favicon_url", site.faviconUrl);
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
    let shouldDeleteAdminPath = false;
    if (body.adminPath !== undefined) {
      if (body.adminPath === "") {
        shouldDeleteAdminPath = true;
      } else {
        settingsToUpdate.push({ key: "admin.path", value: body.adminPath });
      }
    }

    // 存储设置（非敏感配置直接存，敏感信息加密后存储）
    // 需要删除的设置（敏感信息放空时删除，回退到环境变量）
    const settingsToDelete: string[] = [];

    if (body.storage) {
      const { driver, github, s3, local } = body.storage;
      if (driver && ["LOCAL", "GITHUB", "S3"].includes(driver.toUpperCase())) {
        addSetting("storage.driver", driver.toUpperCase());
      }
      if (github) {
        addSetting("storage.github.owner", github.owner);
        addSetting("storage.github.repo", github.repo);
        addSetting("storage.github.branch", github.branch);
        addSetting("storage.github.cdn_base", github.cdnBase);
        // 敏感信息：Token 加密后存储，放空时删除记录
        if (github.token !== undefined) {
          if (github.token === "") {
            settingsToDelete.push("storage.github.token");
          } else {
            const encrypted = encryptIfAvailable(github.token);
            if (encrypted) addSetting("storage.github.token", encrypted);
          }
        }
      }
      if (s3) {
        addSetting("storage.s3.endpoint", s3.endpoint);
        addSetting("storage.s3.bucket", s3.bucket);
        addSetting("storage.s3.region", s3.region);
        // 敏感信息：Access Key 加密后存储，放空时删除记录
        if (s3.accessKey !== undefined) {
          if (s3.accessKey === "") {
            settingsToDelete.push("storage.s3.access_key");
          } else {
            const encrypted = encryptIfAvailable(s3.accessKey);
            if (encrypted) addSetting("storage.s3.access_key", encrypted);
          }
        }
        // 敏感信息：Secret Key 加密后存储，放空时删除记录
        if (s3.secretKey !== undefined) {
          if (s3.secretKey === "") {
            settingsToDelete.push("storage.s3.secret_key");
          } else {
            const encrypted = encryptIfAvailable(s3.secretKey);
            if (encrypted) addSetting("storage.s3.secret_key", encrypted);
          }
        }
      }
      if (local) {
        addSetting("storage.local.upload_dir", local.uploadDir);
      }
    }

    // 批量更新设置
    if (settingsToUpdate.length > 0) {
      await setSettingsBatch(settingsToUpdate);
    }

    // 删除需要清空的设置
    if (shouldDeleteAdminPath) {
      await deleteSetting("admin.path");
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
