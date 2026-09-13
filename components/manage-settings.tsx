"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RefreshCw, Globe, Link2, FileText, Settings as SettingsIcon } from "lucide-react";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import "bytemd/dist/index.css";
import { useToast } from "@/components/toast";

type SiteSettings = {
  name: string;
  description: string;
  seoDescription: string;
  logoUrl: string;
  faviconUrl: string;
};

type SocialLinks = {
  github: string;
  twitter: string;
  email: string;
  rss: string;
};

type FooterSettings = {
  copyright: string;
  icp: string;
};

type StorageSettings = {
  driver: "LOCAL" | "GITHUB" | "S3";
  github: {
    owner: string;
    repo: string;
    branch: string;
    cdnBase: string;
    token: string; // 用户输入的明文（保存时用）
    tokenConfigured?: boolean; // 是否已配置（加载时显示用，不返回明文）
  };
  s3: {
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string; // 用户输入的明文（保存时用）
    secretKey: string; // 用户输入的明文（保存时用）
    accessKeyConfigured?: boolean; // 是否已配置
    secretKeyConfigured?: boolean; // 是否已配置
  };
  local: {
    uploadDir: string;
  };
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
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"site" | "social" | "footer" | "about" | "storage" | "giscus" | "advanced">("site");
  const [originalAdminPath, setOriginalAdminPath] = useState("");

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
  const [storage, setStorage] = useState<StorageSettings>({
    driver: "LOCAL",
    github: { owner: "", repo: "", branch: "", cdnBase: "", token: "", tokenConfigured: false },
    s3: { endpoint: "", bucket: "", region: "", accessKey: "", secretKey: "", accessKeyConfigured: false, secretKeyConfigured: false },
    local: { uploadDir: "" },
  });

  const [giscus, setGiscus] = useState({
    repo: "",
    repoId: "",
    category: "Announcements",
    categoryId: "",
  });

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
        setOriginalAdminPath(data.adminPath ?? ""); // 保存原始路径，用于检测是否变更
        if (data.storage) setStorage(data.storage);
        if (data.giscus) setGiscus(data.giscus);
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
        body: JSON.stringify({ site, social, footer, aboutContent, adminPath, storage, giscus }),
      });
      if (res.ok) {
        // 检测 admin_path 是否发生了变化
        const normalizedNew = adminPath.trim().replace(/^\/+|\/+$/g, "");
        const normalizedOld = originalAdminPath.trim().replace(/^\/+|\/+$/g, "");
        const adminPathChanged = normalizedNew !== normalizedOld && normalizedNew !== "";

        if (adminPathChanged) {
          showToast(`后台路径已更改为 /${normalizedNew}，正在跳转...`, "success");
          // 延迟一下让用户看到提示，然后跳转到新的后台首页
          setTimeout(() => {
            router.push(`/${normalizedNew}`);
          }, 1000);
        } else {
          showToast("保存成功！", "success");
        }
      } else {
        showToast("保存失败，请重试", "error");
      }
    } catch (e) {
      console.error("保存设置失败：", e);
      showToast("保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: "site" as const, label: "站点设置", icon: Globe },
    { id: "social" as const, label: "社交链接", icon: Link2 },
    { id: "footer" as const, label: "页脚设置", icon: SettingsIcon },
    { id: "about" as const, label: "关于页面", icon: FileText },
    { id: "storage" as const, label: "存储设置", icon: SettingsIcon },
    { id: "giscus" as const, label: "评论设置", icon: SettingsIcon },
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
    <div className="container mx-auto px-4 py-8 animate-page-enter">
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

          {/* 存储设置 */}
          {activeSection === "storage" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">存储设置</h2>

              <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>ℹ️ 说明：</strong>
                  敏感信息（GitHub Token、S3 Access Key/Secret Key）使用 AES-256-GCM 加密存储在数据库中，可在此动态配置。
                  环境变量优先级更高（设置了对应环境变量则后台配置不生效）。
                  敏感信息不回显，只显示「已配置」状态，留空则保持当前配置。
                  修改驱动后，新上传的文件将使用新驱动，已上传的文件不受影响。
                </p>
              </div>

              <div className="space-y-6">
                {/* 当前驱动 */}
                <div>
                  <label className={labelClass}>当前存储驱动</label>
                  <div className="flex gap-2">
                    {(["LOCAL", "GITHUB", "S3"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setStorage({ ...storage, driver: d })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          storage.driver === d
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {d === "LOCAL" ? "本地存储" : d === "GITHUB" ? "GitHub 图床" : "S3 兼容存储"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* GitHub 配置 */}
                {storage.driver === "GITHUB" && (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                    <h3 className="font-medium text-sm">GitHub 图床配置</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Owner（用户名/组织）</label>
                        <input
                          type="text"
                          value={storage.github.owner}
                          onChange={(e) => setStorage({ ...storage, github: { ...storage.github, owner: e.target.value } })}
                          className={inputClass}
                          placeholder="lsx-xyg"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Repo（仓库名）</label>
                        <input
                          type="text"
                          value={storage.github.repo}
                          onChange={(e) => setStorage({ ...storage, github: { ...storage.github, repo: e.target.value } })}
                          className={inputClass}
                          placeholder="images"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Branch（分支）</label>
                        <input
                          type="text"
                          value={storage.github.branch}
                          onChange={(e) => setStorage({ ...storage, github: { ...storage.github, branch: e.target.value } })}
                          className={inputClass}
                          placeholder="main"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>CDN 基础 URL</label>
                        <input
                          type="text"
                          value={storage.github.cdnBase}
                          onChange={(e) => setStorage({ ...storage, github: { ...storage.github, cdnBase: e.target.value } })}
                          className={inputClass}
                          placeholder="https://cdn.jsdelivr.net/gh"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>
                          GitHub Token（Personal Access Token）
                          {storage.github.tokenConfigured && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已配置</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            value={storage.github.token}
                            onChange={(e) => setStorage({ ...storage, github: { ...storage.github, token: e.target.value } })}
                            className={`${inputClass} pr-12`}
                            placeholder={storage.github.tokenConfigured ? "留空则保持当前配置，输入新值则覆盖" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.querySelector<HTMLInputElement>('input[placeholder*="ghp_"]');
                              if (input) input.type = input.type === "password" ? "text" : "password";
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            👁
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          需要 repo 权限。加密存储在数据库中，环境变量 GITHUB_STORAGE_TOKEN 优先级更高。
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      访问 URL 格式：{storage.github.cdnBase || "https://cdn.jsdelivr.net/gh"}/{storage.github.owner || "owner"}/{storage.github.repo || "repo"}@{storage.github.branch || "main"}/{'{path}'}
                    </p>
                  </div>
                )}

                {/* S3 配置 */}
                {storage.driver === "S3" && (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                    <h3 className="font-medium text-sm">S3 兼容存储配置</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Endpoint（端点）</label>
                        <input
                          type="text"
                          value={storage.s3.endpoint}
                          onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, endpoint: e.target.value } })}
                          className={inputClass}
                          placeholder="https://oss-cn-hangzhou.aliyuncs.com"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Bucket（存储桶）</label>
                        <input
                          type="text"
                          value={storage.s3.bucket}
                          onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, bucket: e.target.value } })}
                          className={inputClass}
                          placeholder="my-bucket"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Region（区域）</label>
                        <input
                          type="text"
                          value={storage.s3.region}
                          onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, region: e.target.value } })}
                          className={inputClass}
                          placeholder="auto / us-east-1"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Access Key ID
                          {storage.s3.accessKeyConfigured && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已配置</span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={storage.s3.accessKey}
                          onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, accessKey: e.target.value } })}
                          className={inputClass}
                          placeholder={storage.s3.accessKeyConfigured ? "留空则保持当前配置" : "AKIAxxxxxxxxxxxxxxxx"}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Secret Access Key
                          {storage.s3.secretKeyConfigured && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已配置</span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={storage.s3.secretKey}
                          onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, secretKey: e.target.value } })}
                          className={inputClass}
                          placeholder={storage.s3.secretKeyConfigured ? "留空则保持当前配置" : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      敏感信息加密存储在数据库中，环境变量 S3_ACCESS_KEY / S3_SECRET_KEY 优先级更高。
                    </p>
                  </div>
                )}

                {/* LOCAL 配置 */}
                {storage.driver === "LOCAL" && (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                    <h3 className="font-medium text-sm">本地存储配置</h3>
                    <div>
                      <label className={labelClass}>上传目录（相对于项目根目录）</label>
                      <input
                        type="text"
                        value={storage.local.uploadDir}
                        onChange={(e) => setStorage({ ...storage, local: { ...storage.local, uploadDir: e.target.value } })}
                        className={inputClass}
                        placeholder="public/uploads"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      注意：本地存储仅适用于开发环境。Vercel 等 Serverless 平台无持久化文件系统，生产环境请使用 GitHub 或 S3。
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* giscus 评论设置 */}
          {activeSection === "giscus" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-2">评论设置（giscus）</h2>
              <p className="text-sm text-muted-foreground mb-6">
                基于 GitHub Discussions 的评论系统。仓库必须公开且已开启 Discussions。
                配置获取：<a href="https://giscus.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">giscus.app</a>
                <br />
                环境变量优先级更高（设置了 NEXT_PUBLIC_GISCUS_* 则后台配置不生效）。
              </p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>仓库（owner/repo）</label>
                  <input
                    type="text"
                    value={giscus.repo}
                    onChange={(e) => setGiscus({ ...giscus, repo: e.target.value })}
                    className={inputClass}
                    placeholder="lsx-xyg/blog"
                  />
                </div>
                <div>
                  <label className={labelClass}>仓库 ID（repoId）</label>
                  <input
                    type="text"
                    value={giscus.repoId}
                    onChange={(e) => setGiscus({ ...giscus, repoId: e.target.value })}
                    className={inputClass}
                    placeholder="R_kgDOUVJQpg"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>讨论分类（category）</label>
                    <input
                      type="text"
                      value={giscus.category}
                      onChange={(e) => setGiscus({ ...giscus, category: e.target.value })}
                      className={inputClass}
                      placeholder="Announcements"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>分类 ID（categoryId）</label>
                    <input
                      type="text"
                      value={giscus.categoryId}
                      onChange={(e) => setGiscus({ ...giscus, categoryId: e.target.value })}
                      className={inputClass}
                      placeholder="DIC_kwDOUVJQps4DFcnk"
                    />
                  </div>
                </div>
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
