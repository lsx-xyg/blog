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
} from "@/lib/settings";

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
    const [site, social, footer, aboutContent, adminPath] = await Promise.all([
      getSiteSettings(),
      getSocialLinks(),
      getFooterSettings(),
      getAboutContent(),
      getSetting<string>("admin.path"),
    ]);

    return NextResponse.json({
      site,
      social,
      footer,
      aboutContent,
      adminPath: adminPath ?? "",
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
    if (body.adminPath !== undefined && body.adminPath !== "") {
      settingsToUpdate.push({ key: "admin.path", value: body.adminPath });
    }

    // 批量更新设置
    if (settingsToUpdate.length > 0) {
      await setSettingsBatch(settingsToUpdate);
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
