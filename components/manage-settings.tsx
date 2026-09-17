"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Save, RefreshCw, Globe, Link2, FileText, Settings as SettingsIcon, Eye, EyeOff, Check, Copy, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { emitGuideTrigger } from "@/lib/guide/events";
import { GUIDE_TRIGGER_EVENT } from "@/lib/guide-events";
import type { 
  CronSettings, 
  FooterSettings, 
  GiscusSettings, 
  SocialLinks, 
  SiteSettings, 
  StorageSettings 
} from "@/lib/types/settings";
import {STORAGE_DRIVER_VALUES, StorageDriverType} from "@/lib/types/storage";
import {CronDeployPlatform} from "@/lib/types/settings";
import { StorageConfigForm } from "@/components/storage-config-form";
import { SecretRevealDialog } from "@/components/secret-reveal-dialog";
import { usePasswordStatus, getAdminPathFromUrl } from "@/components/use-password-status";

/**
 * AboutEditor 动态导入（Bundle 优化）
 *
 * ByteMD 编辑器体积较大（约 200+ kB），只在编辑关于页面内容时才需要。
 * 使用 dynamic import + ssr: false 延迟加载，
 * 这样站点设置页首屏不会加载编辑器代码，可以大幅减少首屏体积。
 *
 * 优化效果：
 * - 站点设置页 First Load JS：312 kB → 约 150 kB（减少约 50%）
 * - 编辑器只在点击"关于页面"分区时才加载
 */
const AboutEditor = dynamic(
  () => import("@/components/about-editor").then((mod) => mod.AboutEditor),
  {
    ssr: false, // ByteMD 编辑器只能在客户端渲染
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">编辑器加载中...</p>
        </div>
      </div>
    ),
  },
);

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
  const [activeSection, setActiveSection] = useState<"site" | "social" | "footer" | "about" | "storage" | "giscus" | "cron" | "advanced">("site");
  const [originalAdminPath, setOriginalAdminPath] = useState("");

  const [site, setSite] = useState<SiteSettings>({
    name: "",
    description: "",
    seoDescription: "",
    logoUrl: "",
    faviconUrl: "",
    siteUrl: "",
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
    driver: StorageDriverType.LOCAL as StorageDriverType,
    github: { owner: "", repo: "", branch: "", cdnBase: "", directory: "", token: "", tokenConfigured: false },
    s3: { endpoint: "", bucket: "", region: "", directory: "", accessKey: "", secretKey: "", accessKeyConfigured: false, secretKeyConfigured: false },
    local: { uploadDir: "", directory: "" },
  });

  const [privateStorage, setPrivateStorage] = useState<StorageSettings>({
    driver: StorageDriverType.LOCAL as StorageDriverType,
    github: { owner: "", repo: "", branch: "", cdnBase: "", directory: "", token: "", tokenConfigured: false },
    s3: { endpoint: "", bucket: "", region: "", directory: "", accessKey: "", secretKey: "", accessKeyConfigured: false, secretKeyConfigured: false },
    local: { uploadDir: "", directory: "" },
  });

  // 存储设置分区：公开存储 / 私有存储 切换
  const [storageTab, setStorageTab] = useState<"public" | "private">("public");

  const [giscus, setGiscus] = useState<GiscusSettings>({
    repo: "",
    repoId: "",
    category: "Announcements",
    categoryId: "",
  });

  const [cron, setCron] = useState<CronSettings>({
    deployPlatform: CronDeployPlatform.VERCEL as CronDeployPlatform,
    secret: "",
    secretConfigured: false,
    jobApiKey: "",
    jobApiKeyConfigured: false,
  });

  // 敏感信息二次验证（#18）：cron.secret / cron.jobApiKey 查看明文
  const [revealDialog, setRevealDialog] = useState<{ key: string; label: string } | null>(null);
  const [revealed, setRevealed] = useState<{ key: string; value: string } | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [copied, setCopied] = useState(false);
  // 账号是否已设置密码（无密码时点「查看」触发新手引导设置密码）
  const { hasPassword } = usePasswordStatus();
  // 输入内容显示/隐藏（👁）
  const [showCronSecret, setShowCronSecret] = useState(false);
  const [showCronJobApiKey, setShowCronJobApiKey] = useState(false);

  // 明文 30 秒倒计时，到期自动隐藏
  useEffect(() => {
    if (!revealed) return;
    setCountdown(30);
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [revealed]);

  useEffect(() => {
    if (revealed && countdown <= 0) setRevealed(null);
  }, [countdown, revealed]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  /** label 行「查看已配置明文」按钮；无密码账号触发新手引导设置密码（#18） */
  const cronRevealButton = (key: string, label: string, configured?: boolean) =>
    configured ? (
      <button
        type="button"
        data-guide="reveal-view"
        onClick={(e) => {
          if (hasPassword === false) {
            // 无密码：触发新手引导（弹窗说明 + 按钮引导设置密码），不弹验证框
            emitGuideTrigger({
              event: GUIDE_TRIGGER_EVENT,
              target: "reveal-view",
              page: "/settings",
            });
            return;
          }
          setRevealDialog({ key, label });
        }}
        className="ml-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="验证后查看明文"
      >
        <Eye className="h-3.5 w-3.5" />
        查看
      </button>
    ) : null;

  /** 输入框内 👁：切换输入内容显示/隐藏（type=password 语义） */
  const eyeToggle = (show: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      tabIndex={-1}
      title={show ? "隐藏输入内容" : "显示输入内容"}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  /** cron 敏感字段明文展示条（30 秒自动隐藏） */
  const cronRevealBanner = (key: string, label: string) =>
    revealed?.key === key ? (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <span className="shrink-0 text-xs text-muted-foreground">{label}：</span>
        <code className="flex-1 break-all text-sm text-foreground">{revealed.value}</code>
        <button
          type="button"
          onClick={() => handleCopy(revealed.value)}
          className="shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="复制明文"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
        <span className="shrink-0 text-xs text-muted-foreground" title="到期自动隐藏">
          {countdown}s
        </span>
      </div>
    ) : null;

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
        if (data.privateStorage) setPrivateStorage(data.privateStorage);
        if (data.giscus) setGiscus(data.giscus);
        if (data.cron) setCron(data.cron);
      }
    } catch (e) {
      console.error("加载设置失败：", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    checkEncryption(true);
  }, []);

  /** 加密状态：ENCRYPTION_KEY 是否配置 / 是否有效（能解出库中密文） */
  const [encryption, setEncryption] = useState<{
    configured: boolean;
    valid: boolean | null;
    sampleKey: string | null;
    hasSample: boolean;
  } | null>(null);
  const [checkingEncryption, setCheckingEncryption] = useState(false);

  const checkEncryption = async (silent = false) => {
    setCheckingEncryption(true);
    try {
      const res = await fetch("/api/admin/security/encryption-status");
      if (res.ok) {
        const data = await res.json();
        setEncryption(data);
        if (!silent) {
          if (!data.configured) {
            showToast("未配置 ENCRYPTION_KEY", "error");
          } else if (data.valid === false) {
            showToast("密钥无效：库中密文无法用当前密钥解密", "error");
          } else if (data.valid === true) {
            showToast("密钥有效，解密验证通过", "success");
          } else {
            showToast("密钥已配置（库中暂无敏感数据可验证）", "success");
          }
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "检测加密状态失败", "error");
      }
    } catch (e) {
      console.error("检测加密状态失败：", e);
      if (!silent) showToast("检测加密状态失败，请重试", "error");
    } finally {
      setCheckingEncryption(false);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, social, footer, aboutContent, adminPath, storage, privateStorage, giscus, cron }),
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
    { id: "cron" as const, label: "定时任务", icon: SettingsIcon },
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
    <div className="animate-page-enter">
      {/* 标题和操作 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">站点设置</h1>
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
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${activeSection === section.id
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
                  <div>
                    <label className={labelClass}>站点 URL（NEXT_PUBLIC_SITE_URL）</label>
                    <input
                      type="text"
                      value={site.siteUrl ?? ""}
                      onChange={(e) => setSite({ ...site, siteUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://blog.dbthree.dpdns.org"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      用于定时任务、SEO、RSS 等功能生成完整 URL。环境变量 NEXT_PUBLIC_SITE_URL 优先级更高。
                    </p>
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
              <AboutEditor
                value={aboutContent}
                onChange={setAboutContent}
              />
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

              {/* 公开/私有存储切换标签 */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setStorageTab("public")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${storageTab === "public"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                >
                  公开存储（图片/视频）
                </button>
                <button
                  type="button"
                  onClick={() => setStorageTab("private")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${storageTab === "private"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                >
                  私有存储（备份/敏感数据）
                </button>
              </div>

              {/* 公开存储配置表单 */}
              {storageTab === "public" && (
                <StorageConfigForm
                  storage={storage}
                  setStorage={setStorage}
                  isPrivate={false}
                />
              )}

              {/* 私有存储配置表单 */}
              {storageTab === "private" && (
                <StorageConfigForm
                  storage={privateStorage}
                  setStorage={setPrivateStorage}
                  isPrivate={true}
                />
              )}
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

          {/* 定时任务设置 */}
          {activeSection === "cron" && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-2">定时任务设置（T12 文章定时发布）</h2>
              {hasPassword === false && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  当前账号未设置密码（通过 GitHub 登录创建），敏感信息查看前需要先设置密码。
                  <a
                    href={`/${getAdminPathFromUrl()}/account`}
                    className="ml-1 font-medium underline underline-offset-2"
                  >
                    前往设置密码 →
                  </a>
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-6">
                两套实现，通过部署平台切换：
                <br />
                - <strong>VERCEL</strong>：使用 cron-job.org 外部定时任务（推荐，Vercel serverless 无持久化进程）
                <br />
                - <strong>SERVER</strong>：使用 node-cron 内置定时任务（自有服务器时使用）
                <br />
                环境变量优先级更高（设置了对应环境变量则后台配置不生效）。
              </p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>部署平台</label>
                  <select
                    className={`${inputClass} mt-1 w-full`}
                    value={cron.deployPlatform}
                    onChange={(e) => setCron({ ...cron, deployPlatform: e.target.value as CronDeployPlatform })}
                  >
                    <option value={CronDeployPlatform.VERCEL}>VERCEL（cron-job.org 外部定时任务）</option>
                    <option value={CronDeployPlatform.SERVER}>SERVER（node-cron 内置定时任务）</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    注意：应用启动时使用环境变量 DEPLOY_PLATFORM 决定是否启动 node-cron，修改后需重启应用生效。
                  </p>
                </div>
                <div>
                  <label className={labelClass}>
                    CRON_SECRET（定时任务接口鉴权密钥）
                    {cron.secretConfigured && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已配置</span>
                    )}
                    {cronRevealButton("cron.secret", "CRON_SECRET", cron.secretConfigured)}
                  </label>
                  <div className="relative">
                    <input
                      type={showCronSecret ? "text" : "password"}
                      value={cron.secret}
                      onChange={(e) => setCron({ ...cron, secret: e.target.value })}
                      className={`${inputClass} pr-10`}
                      placeholder={cron.secretConfigured ? "留空则保持当前配置，输入新值则覆盖" : "生成方式：openssl rand -hex 32"}
                    />
                    {eyeToggle(showCronSecret, () => setShowCronSecret((v) => !v))}
                  </div>
                  {cronRevealBanner("cron.secret", "CRON_SECRET")}
                  <p className="mt-1 text-xs text-muted-foreground">
                    用于定时任务接口鉴权，AES-256-GCM 加密存储。修改后需重新创建 cron-job.org 定时任务（URL 中编码了 secret）。
                  </p>
                </div>
                <div>
                  <label className={labelClass}>
                    CRON_JOB_API_KEY（cron-job.org API Key）
                    {cron.jobApiKeyConfigured && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已配置</span>
                    )}
                    {cronRevealButton("cron.jobApiKey", "CRON_JOB_API_KEY", cron.jobApiKeyConfigured)}
                  </label>
                  <div className="relative">
                    <input
                      type={showCronJobApiKey ? "text" : "password"}
                      value={cron.jobApiKey}
                      onChange={(e) => setCron({ ...cron, jobApiKey: e.target.value })}
                      className={`${inputClass} pr-10`}
                      placeholder={cron.jobApiKeyConfigured ? "留空则保持当前配置，输入新值则覆盖" : "获取地址：https://cron-job.org/en/members/settings/"}
                    />
                    {eyeToggle(showCronJobApiKey, () => setShowCronJobApiKey((v) => !v))}
                  </div>
                  {cronRevealBanner("cron.jobApiKey", "CRON_JOB_API_KEY")}
                  <p className="mt-1 text-xs text-muted-foreground">
                    VERCEL 模式下用于调用 cron-job.org API 创建/删除定时任务，AES-256-GCM 加密存储。
                  </p>
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

                {/* 安全与加密：ENCRYPTION_KEY 状态检测 */}
                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-1.5 text-sm font-medium">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        加密密钥（ENCRYPTION_KEY）
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        主密钥：加密数据库敏感配置、accounts 敏感字段与备份文件（AES-256-GCM）
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => checkEncryption()}
                      disabled={checkingEncryption}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
                    >
                      {checkingEncryption ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      测试解密
                    </button>
                  </div>

                  {encryption && (
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-2 w-2 rounded-full ${
                            encryption.configured ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-xs text-muted-foreground">
                          环境变量状态：
                          <span className={encryption.configured ? "font-medium text-green-600" : "font-medium text-red-500"}>
                            {encryption.configured ? "已配置" : "未配置"}
                          </span>
                        </span>
                      </div>

                      {encryption.configured && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-2 w-2 rounded-full ${
                              encryption.valid === true
                                ? "bg-green-500"
                                : encryption.valid === false
                                  ? "bg-red-500"
                                  : "bg-gray-400"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">
                            密钥有效性：
                            {encryption.valid === true ? (
                              <span className="font-medium text-green-600">有效（已成功解密库中密文）</span>
                            ) : encryption.valid === false ? (
                              <span className="font-medium text-red-500">无效（库中密文无法解密，密钥可能不匹配）</span>
                            ) : (
                              <span className="font-medium text-gray-400">暂无数据可验证（库中尚无敏感配置）</span>
                            )}
                          </span>
                        </div>
                      )}

                      {encryption.sampleKey && (
                        <p className="text-xs text-gray-500">验证样本：{encryption.sampleKey}</p>
                      )}

                      {!encryption.configured && (
                        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                          <p className="text-xs leading-relaxed text-red-700 dark:text-red-400">
                            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                            ENCRYPTION_KEY 未配置：数据库敏感配置将明文存储、备份文件不加密。请到部署平台（如
                            Vercel）的环境变量中设置（32 字节随机值 Base64）。生成命令：
                            <code className="mt-1 block rounded bg-background px-2 py-1 font-mono text-xs">
                              node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
                            </code>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 敏感信息二次验证弹窗（cron 密钥） */}
      <SecretRevealDialog
        open={!!revealDialog}
        fieldLabel={revealDialog?.label ?? ""}
        fieldKey={revealDialog?.key ?? ""}
        onClose={() => setRevealDialog(null)}
        onRevealed={(value) => {
          if (revealDialog) {
            setRevealed({ key: revealDialog.key, value });
            setRevealDialog(null);
          }
        }}
      />
    </div>
  );
}
