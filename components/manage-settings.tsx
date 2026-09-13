"use client";

import { useEffect, useState } from "react";
import { Save, RefreshCw, Globe, Link2, FileText, Settings as SettingsIcon } from "lucide-react";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import "bytemd/dist/index.css";

type SiteSettings = {
  name: string;
  description: string;
  seoDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
};

type SocialLinks = {
  github: string | null;
  twitter: string | null;
  email: string | null;
  rss: string;
};

type FooterSettings = {
  copyright: string;
  icp: string | null;
};

const plugins = [gfm()];

/**
 * 后台设置管理组件
 *
 * 分区：
 * 1. 站点设置（站名/简介/SEO/Logo/Favicon）
 * 2. 社交链接（GitHub/Twitter/邮箱/RSS）
 * 3. 页脚设置（版权/ICP）
 * 4. 关于页面内容（Markdown 编辑器）
 */
export function ManageSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"site" | "social" | "footer" | "about" | "advanced">("site");

  const [site, setSite] = useState<SiteSettings>({
    name: "",
    description: "",
    seoDescription: "",
    logoUrl: "",
    faviconUrl: "",
  });

  const [social, setSocial] = useState<SocialLinks>({
    github: "",
    twitter: "",
    email: "",
    rss: "/rss.xml",
  });

  const [footer, setFooter] = useState<FooterSettings>({
    copyright: "",
    icp: "",
  });

  const [aboutContent, setAboutContent] = useState("");
  const [adminPath, setAdminPath] = useState("");

  // 加载设置
  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSite(data.site);
        setSocial(data.social);
        setFooter(data.footer);
        setAboutContent(data.aboutContent);
        setAdminPath(data.adminPath ?? "");
      }
    } catch (e) {
      console.error("加载设置失败：", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // 保存设置
  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, social, footer, aboutContent, adminPath }),
      });
      if (res.ok) {
        alert("保存成功！");
      } else {
        alert("保存失败，请重试");
      }
    } catch (e) {
      console.error("保存设置失败：", e);
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: "site" as const, label: "站点设置", icon: Globe },
    { id: "social" as const, label: "社交链接", icon: Link2 },
    { id: "footer" as const, label: "页脚设置", icon: SettingsIcon },
    { id: "about" as const, label: "关于页面", icon: FileText },
    { id: "advanced" as const, label: "高级设置", icon: SettingsIcon },
  ];

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  const labelClass = "block text-sm font-medium mb-1.5";

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">加载中…</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 标题和操作 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">站点设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">配置站点信息、社交链接、页脚和关于页面</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSettings}
            className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            重置
          </button>
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存设置
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左侧导航 */}
        <div className="lg:w-48 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 min-w-0">
          {/* 站点设置 */}
          {activeSection === "site" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">站点设置</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>站点名称</label>
                  <input
                    type="text"
                    value={site.name}
                    onChange={(e) => setSite({ ...site, name: e.target.value })}
                    className={inputClass}
                    placeholder="林圣轩blog"
                  />
                </div>
                <div>
                  <label className={labelClass}>站点简介</label>
                  <textarea
                    value={site.description}
                    onChange={(e) => setSite({ ...site, description: e.target.value })}
                    className={`${inputClass} min-h-[80px] resize-y`}
                    placeholder="技术写作与生活记录"
                  />
                </div>
                <div>
                  <label className={labelClass}>SEO 描述</label>
                  <textarea
                    value={site.seoDescription}
                    onChange={(e) => setSite({ ...site, seoDescription: e.target.value })}
                    className={`${inputClass} min-h-[80px] resize-y`}
                    placeholder="用于搜索引擎的描述信息"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Logo URL（可选）</label>
                    <input
                      type="text"
                      value={site.logoUrl ?? ""}
                      onChange={(e) => setSite({ ...site, logoUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Favicon URL（可选）</label>
                    <input
                      type="text"
                      value={site.faviconUrl ?? ""}
                      onChange={(e) => setSite({ ...site, faviconUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://example.com/favicon.ico"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 社交链接 */}
          {activeSection === "social" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">社交链接</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>GitHub</label>
                  <input
                    type="text"
                    value={social.github ?? ""}
                    onChange={(e) => setSocial({ ...social, github: e.target.value })}
                    className={inputClass}
                    placeholder="https://github.com/yourname"
                  />
                </div>
                <div>
                  <label className={labelClass}>Twitter / X</label>
                  <input
                    type="text"
                    value={social.twitter ?? ""}
                    onChange={(e) => setSocial({ ...social, twitter: e.target.value })}
                    className={inputClass}
                    placeholder="https://twitter.com/yourname"
                  />
                </div>
                <div>
                  <label className={labelClass}>邮箱</label>
                  <input
                    type="email"
                    value={social.email ?? ""}
                    onChange={(e) => setSocial({ ...social, email: e.target.value })}
                    className={inputClass}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>RSS 订阅地址</label>
                  <input
                    type="text"
                    value={social.rss}
                    onChange={(e) => setSocial({ ...social, rss: e.target.value })}
                    className={inputClass}
                    placeholder="/rss.xml"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 页脚设置 */}
          {activeSection === "footer" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">页脚设置</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>版权文字</label>
                  <input
                    type="text"
                    value={footer.copyright}
                    onChange={(e) => setFooter({ ...footer, copyright: e.target.value })}
                    className={inputClass}
                    placeholder="© 2024 林圣轩blog. All rights reserved."
                  />
                  <p className="mt-1 text-xs text-muted-foreground">留空则使用默认格式（自动包含年份）</p>
                </div>
                <div>
                  <label className={labelClass}>ICP 备案号（可选）</label>
                  <input
                    type="text"
                    value={footer.icp ?? ""}
                    onChange={(e) => setFooter({ ...footer, icp: e.target.value })}
                    className={inputClass}
                    placeholder="京ICP备XXXXXXXX号"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 关于页面 */}
          {activeSection === "about" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">关于页面内容</h2>
              <p className="text-sm text-muted-foreground mb-4">使用 Markdown 格式编写关于页面的内容</p>
              <div className="bytemd-wrapper">
                <Editor
                  value={aboutContent}
                  onChange={setAboutContent}
                  plugins={plugins}
                  mode="split"
                />
              </div>
            </div>
          )}

          {/* 高级设置 */}
          {activeSection === "advanced" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">高级设置</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>后台路径（admin_path）</label>
                  <input
                    type="text"
                    value={adminPath}
                    onChange={(e) => setAdminPath(e.target.value)}
                    className={inputClass}
                    placeholder="留空则使用环境变量 ADMIN_PATH"
                  />
                  <div className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      <strong>⚠️ 警告：</strong>修改后台路径后，当前路径将立即失效，请使用新路径访问后台。
                      环境变量 ADMIN_PATH 优先级高于此设置，如需使用此设置请先移除环境变量。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
