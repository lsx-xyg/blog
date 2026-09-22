'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Save,
  RefreshCw,
  Globe,
  Link2,
  FileText,
  Settings as SettingsIcon,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Megaphone,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import type {
  CronSettings,
  FooterSettings,
  GiscusSettings,
  SeoSettings,
  SocialLinks,
  SiteSettings,
} from '@/lib/types/settings';
import { CronDeployPlatform } from '@/lib/types/settings';
import { CronSection } from '@/components/settings/cron-section';

/**
 * MarkdownEditor 动态导入（Bundle 优化）
 *
 * ByteMD 编辑器体积较大（约 200+ kB），只在编辑关于页面内容时才需要。
 * 使用 dynamic import + ssr: false 延迟加载，
 * 这样站点设置页首屏不会加载编辑器代码，可以大幅减少首屏体积。
 *
 * 优化效果：
 * - 站点设置页 First Load JS：312 kB → 约 150 kB（减少约 50%）
 * - 编辑器只在点击"关于页面"分区时才加载
 */
const MarkdownEditor = dynamic(
  () => import('@/components/shared/markdown-editor').then((mod) => mod.MarkdownEditor),
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
 * 分区（对应 activeSection）：
 * 1. site      站点设置（站名/简介/SEO/Logo/Favicon/站点 URL）
 * 2. seo       搜索收录（IndexNow 自动推送 + 手动全量推送入口）
 * 3. social    社交链接（GitHub/Twitter/邮箱/RSS）
 * 4. footer    页脚设置（版权/ICP）
 * 5. about     关于页面内容（Markdown 编辑器，动态导入）
 * 6. giscus    评论设置
 * 7. cron      定时任务（CronSection，敏感字段自持交互）
 * 8. advanced  高级设置（后台路径 + 加密状态）
 *
 * 存储设置不在这里：已独立为 `/{adminSlug}/storage`（档案池 + 通道绑定，见
 * components/manage/manage-storage.tsx），本页只保留一个跳转入口。
 */
export function ManageSettings() {
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'site' | 'seo' | 'social' | 'footer' | 'about' | 'giscus' | 'cron' | 'advanced'
  >('site');
  const [originalAdminPath, setOriginalAdminPath] = useState('');

  const [site, setSite] = useState<SiteSettings>({
    name: '',
    description: '',
    seoTitle: '',
    seoDescription: '',
    logoUrl: '',
    faviconUrl: '',
    siteUrl: '',
  });

  const [social, setSocial] = useState<SocialLinks>({
    github: '',
    twitter: '',
    email: '',
    rss: '/rss.xml',
  });

  // 搜索收录（IndexNow）：设置值走全局保存；手动推送走独立按钮
  const [seo, setSeo] = useState<SeoSettings>({
    indexNowEnabled: false,
    indexNowKey: '',
  });
  const [indexNowStatus, setIndexNowStatus] = useState<{
    enabled: boolean;
    key: string;
    keyValid: boolean;
    keyFileUrl: string;
    siteUrl: string;
    urlCount: number;
  } | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [footer, setFooter] = useState<FooterSettings>({
    copyright: '',
    icp: '',
  });

  const [aboutContent, setAboutContent] = useState('');
  const [adminPath, setAdminPath] = useState('');

  const [giscus, setGiscus] = useState<GiscusSettings>({
    repo: '',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    enabled: true,
  });

  const [cron, setCron] = useState<CronSettings>({
    deployPlatform: CronDeployPlatform.VERCEL as CronDeployPlatform,
    secret: '',
    secretConfigured: false,
    jobApiKey: '',
    jobApiKeyConfigured: false,
  });

  // 加载设置
  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSite(data.site);
        setSeo(
          data.seo ?? {
            indexNowEnabled: false,
            indexNowKey: '',
          },
        );
        setSocial(data.social);
        setFooter(data.footer);
        setAboutContent(data.aboutContent);
        setAdminPath(data.adminPath ?? '');
        setOriginalAdminPath(data.adminPath ?? ''); // 保存原始路径，用于检测是否变更
        if (data.giscus) setGiscus(data.giscus);
        if (data.cron) setCron(data.cron);
      }
    } catch (e) {
      console.error('加载设置失败：', e);
    } finally {
      setLoading(false);
    }
  };

  /** 加密状态：ENCRYPTION_KEY 是否配置 / 是否有效（能解出库中密文） */
  const [encryption, setEncryption] = useState<{
    configured: boolean;
    valid: boolean | null;
    sampleKey: string | null;
    hasSample: boolean;
  } | null>(null);

  const [checkingEncryption, setCheckingEncryption] = useState(false);

  const checkEncryption = useCallback(
    async (silent = false) => {
      setCheckingEncryption(true);
      try {
        const res = await fetch('/api/admin/security/encryption-status');
        if (res.ok) {
          const data = await res.json();
          setEncryption(data);
          if (!silent) {
            if (!data.configured) {
              showToast('未配置 ENCRYPTION_KEY', 'error');
            } else if (data.valid === false) {
              showToast('密钥无效：库中密文无法用当前密钥解密', 'error');
            } else if (data.valid === true) {
              showToast('密钥有效，解密验证通过', 'success');
            } else {
              showToast('密钥已配置（库中暂无敏感数据可验证）', 'success');
            }
          }
        } else {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || '检测加密状态失败', 'error');
        }
      } catch (e) {
        console.error('检测加密状态失败：', e);
        if (!silent) showToast('检测加密状态失败，请重试', 'error');
      } finally {
        setCheckingEncryption(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    loadSettings();
    checkEncryption(true);
  }, [checkEncryption]);

  // 进入「搜索收录」分区时拉取 IndexNow 状态（密钥文件地址、可推送 URL 数等）
  useEffect(() => {
    if (activeSection !== 'seo') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/seo/indexnow');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setIndexNowStatus(data);
        }
      } catch {
        // 状态拉取失败不打扰用户，推送按钮自身会报错
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  /** 一键推送全站 URL 到 IndexNow（Bing / Yandex / Seznam / Naver 共享通知） */
  const pushAllToIndexNow = async () => {
    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/admin/seo/indexnow', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPushResult({
          ok: data.ok,
          text: data.ok
            ? `推送成功：${data.submitted}/${data.urlCount} 条 URL 已提交（${data.message}）`
            : `推送未生效：${data.message}`,
        });
        showToast(
          data.ok ? `已提交 ${data.submitted} 条 URL` : `推送未生效：${data.message}`,
          data.ok ? 'success' : 'error',
        );
      } else {
        setPushResult({ ok: false, text: data.error || '推送请求失败' });
        showToast(data.error || '推送请求失败', 'error');
      }
    } catch {
      setPushResult({ ok: false, text: '推送请求失败，请重试' });
      showToast('推送请求失败，请重试', 'error');
    } finally {
      setPushing(false);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site,
          seo,
          social,
          footer,
          aboutContent,
          adminPath,
          giscus,
          cron,
        }),
      });
      if (res.ok) {
        // 检测 admin_path 是否发生了变化
        const normalizedNew = adminPath.trim().replace(/^\/+|\/+$/g, '');
        const normalizedOld = originalAdminPath.trim().replace(/^\/+|\/+$/g, '');
        const adminPathChanged = normalizedNew !== normalizedOld && normalizedNew !== '';

        if (adminPathChanged) {
          showToast(`后台路径已更改为 /${normalizedNew}，正在跳转...`, 'success');
          // 延迟一下让用户看到提示，然后跳转到新的后台首页
          setTimeout(() => {
            router.push(`/${normalizedNew}`);
          }, 1000);
        } else {
          showToast('保存成功！', 'success');
        }
      } else {
        showToast('保存失败，请重试', 'error');
      }
    } catch (e) {
      console.error('保存设置失败：', e);
      showToast('保存失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'site' as const, label: '站点设置', icon: Globe },
    { id: 'seo' as const, label: '搜索收录', icon: Megaphone },
    { id: 'social' as const, label: '社交链接', icon: Link2 },
    { id: 'footer' as const, label: '页脚设置', icon: SettingsIcon },
    { id: 'about' as const, label: '关于页面', icon: FileText },
    { id: 'giscus' as const, label: '评论设置', icon: SettingsIcon },
    { id: 'cron' as const, label: '定时任务', icon: SettingsIcon },
    { id: 'advanced' as const, label: '高级设置', icon: SettingsIcon },
  ];

  const inputClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
  const labelClass = 'block text-sm font-medium mb-1.5';

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
          <p className="mt-1 text-sm text-muted-foreground">
            配置站点信息、社交链接、页脚和关于页面
          </p>
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
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
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
          {activeSection === 'site' && (
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
                  <label className={labelClass}>SEO 标题（可选）</label>
                  <input
                    type="text"
                    value={site.seoTitle ?? ''}
                    onChange={(e) => setSite({ ...site, seoTitle: e.target.value })}
                    className={inputClass}
                    placeholder="留空则自动用「站点名称 · 站点简介」"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    首页 &lt;title&gt; 显式覆盖。建议 20~30 字，当前{' '}
                    <span
                      className={
                        site.seoTitle && (site.seoTitle.length < 15 || site.seoTitle.length > 60)
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }
                    >
                      {(site.seoTitle ?? '').length}
                    </span>{' '}
                    字。
                  </p>
                </div>
                <div>
                  <label className={labelClass}>SEO 描述</label>
                  <textarea
                    value={site.seoDescription}
                    onChange={(e) => setSite({ ...site, seoDescription: e.target.value })}
                    className={`${inputClass} min-h-[80px] resize-y`}
                    placeholder="用于搜索引擎的描述信息"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    建议 50~160 字（过短/过长会被 Bing 标记），当前{' '}
                    <span
                      className={
                        site.seoDescription.length > 0 &&
                        (site.seoDescription.length < 30 || site.seoDescription.length > 160)
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }
                    >
                      {site.seoDescription.length}
                    </span>{' '}
                    字。
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Logo URL（可选）</label>
                    <input
                      type="text"
                      value={site.logoUrl ?? ''}
                      onChange={(e) => setSite({ ...site, logoUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Favicon URL（可选）</label>
                    <input
                      type="text"
                      value={site.faviconUrl ?? ''}
                      onChange={(e) => setSite({ ...site, faviconUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://example.com/favicon.ico"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>站点 URL（NEXT_PUBLIC_SITE_URL）</label>
                    <input
                      type="text"
                      value={site.siteUrl ?? ''}
                      onChange={(e) => setSite({ ...site, siteUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://blog.dbthree.dpdns.org"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      用于定时任务、SEO、RSS 等功能生成完整 URL。环境变量 NEXT_PUBLIC_SITE_URL
                      优先级更高。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 搜索收录（IndexNow） */}
          {activeSection === 'seo' && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">搜索收录（IndexNow）</h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                文章发布/更新时自动通知搜索引擎抓取（通常分钟级），一次提交 Bing / Yandex / Seznam /
                Naver 全部共享。
                <strong> Google 不参与 IndexNow</strong>
                （其 Indexing API 仅限招聘/直播页，站点地图 ping 已下线）——Google 侧由{' '}
                <code className="rounded bg-accent px-1 font-mono text-xs">/sitemap.xml</code> +
                Search Console 覆盖，无需额外操作。
              </p>
              <div className="space-y-5">
                {/* 自动推送开关 */}
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={seo.indexNowEnabled}
                    onChange={(e) => setSeo({ ...seo, indexNowEnabled: e.target.checked })}
                    className="accent-primary h-4 w-4"
                  />
                  启用自动推送（文章发布 / 更新 / 定时发布到期时自动提交 IndexNow）
                </label>

                {/* 密钥 */}
                <div>
                  <label className={labelClass}>IndexNow 密钥</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={seo.indexNowKey ?? ''}
                      onChange={(e) => setSeo({ ...seo, indexNowKey: e.target.value })}
                      className={`${inputClass} font-mono`}
                      placeholder="留空则首次推送时自动生成（32 位十六进制）"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSeo({
                          ...seo,
                          indexNowKey: crypto.randomUUID().replace(/-/g, ''),
                        })
                      }
                      className="whitespace-nowrap rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      重新生成
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    密钥是<strong>公开值</strong>
                    （引擎要抓取密钥文件验证站点所有权）。修改密钥后请点「保存设置」，密钥文件地址：
                    {indexNowStatus?.keyFileUrl ? (
                      <a
                        href={indexNowStatus.keyFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {indexNowStatus.keyFileUrl}
                      </a>
                    ) : (
                      '保存并生成密钥后显示'
                    )}
                  </p>
                </div>

                {/* 手动全量推送 */}
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">手动全量推送</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        一键提交全站 URL（首页 + 关于/友链/相册 + 全部已发布文章 + RSS）
                        {indexNowStatus ? `，当前共 ${indexNowStatus.urlCount} 条` : ''}
                        ，无需再去 Bing 官网逐条提交。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={pushAllToIndexNow}
                      disabled={pushing || !seo.indexNowEnabled}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {pushing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Megaphone className="h-4 w-4" />
                      )}
                      立即推送全部 URL
                    </button>
                  </div>
                  {!seo.indexNowEnabled && (
                    <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                      需先勾选「启用自动推送」并保存设置后，推送才会真正提交。
                    </p>
                  )}
                  {pushResult && (
                    <p
                      className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed ${
                        pushResult.ok
                          ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                          : 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {pushResult.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 社交链接 */}
          {activeSection === 'social' && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">社交链接</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>GitHub</label>
                  <input
                    type="text"
                    value={social.github ?? ''}
                    onChange={(e) => setSocial({ ...social, github: e.target.value })}
                    className={inputClass}
                    placeholder="https://github.com/yourname"
                  />
                </div>
                <div>
                  <label className={labelClass}>Twitter / X</label>
                  <input
                    type="text"
                    value={social.twitter ?? ''}
                    onChange={(e) => setSocial({ ...social, twitter: e.target.value })}
                    className={inputClass}
                    placeholder="https://twitter.com/yourname"
                  />
                </div>
                <div>
                  <label className={labelClass}>邮箱</label>
                  <input
                    type="email"
                    value={social.email ?? ''}
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
          {activeSection === 'footer' && (
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    留空则使用默认格式（自动包含年份）
                  </p>
                </div>
                <div>
                  <label className={labelClass}>ICP 备案号（可选）</label>
                  <input
                    type="text"
                    value={footer.icp ?? ''}
                    onChange={(e) => setFooter({ ...footer, icp: e.target.value })}
                    className={inputClass}
                    placeholder="京ICP备XXXXXXXX号"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 关于页面 */}
          {activeSection === 'about' && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-4">关于页面内容</h2>
              <p className="text-sm text-muted-foreground mb-4">
                使用 Markdown 格式编写关于页面的内容（支持粘贴/拖拽上传图片、媒体库选图）
              </p>
              <MarkdownEditor value={aboutContent} onChange={setAboutContent} />
            </div>
          )}

          {/* giscus 评论设置 */}
          {activeSection === 'giscus' && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h2 className="text-lg font-semibold mb-2">评论设置（giscus）</h2>
              <p className="text-sm text-muted-foreground mb-6">
                基于 GitHub Discussions 的评论系统。仓库必须公开且已开启 Discussions。 配置获取：
                <a
                  href="https://giscus.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  giscus.app
                </a>
                <br />
                环境变量优先级更高（设置了 NEXT_PUBLIC_GISCUS_* 则后台配置不生效）。
              </p>
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={giscus.enabled}
                    onChange={(e) => setGiscus({ ...giscus, enabled: e.target.checked })}
                    className="accent-primary h-4 w-4"
                  />
                  启用评论（关闭后文章页不显示评论区）
                </label>
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
          {activeSection === 'cron' && <CronSection cron={cron} setCron={setCron} />}

          {/* 高级设置 */}
          {activeSection === 'advanced' && (
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
                      <strong>⚠️ 警告：</strong>
                      修改后台路径后，当前路径将立即失效，请使用新路径访问后台。 环境变量 ADMIN_PATH
                      优先级高于此设置，如需使用此设置请先移除环境变量。
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
                            encryption.configured ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-xs text-muted-foreground">
                          环境变量状态：
                          <span
                            className={
                              encryption.configured
                                ? 'font-medium text-green-600'
                                : 'font-medium text-red-500'
                            }
                          >
                            {encryption.configured ? '已配置' : '未配置'}
                          </span>
                        </span>
                      </div>

                      {encryption.configured && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-2 w-2 rounded-full ${
                              encryption.valid === true
                                ? 'bg-green-500'
                                : encryption.valid === false
                                  ? 'bg-red-500'
                                  : 'bg-gray-400'
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">
                            密钥有效性：
                            {encryption.valid === true ? (
                              <span className="font-medium text-green-600">
                                有效（已成功解密库中密文）
                              </span>
                            ) : encryption.valid === false ? (
                              <span className="font-medium text-red-500">
                                无效（库中密文无法解密，密钥可能不匹配）
                              </span>
                            ) : (
                              <span className="font-medium text-gray-400">
                                暂无数据可验证（库中尚无敏感配置）
                              </span>
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
                            ENCRYPTION_KEY
                            未配置：数据库敏感配置将明文存储、备份文件不加密。请到部署平台（如
                            Vercel）的环境变量中设置（32 字节随机值 Base64）。生成命令：
                            <code className="mt-1 block rounded bg-background px-2 py-1 font-mono text-xs">
                              node -e
                              "console.log(require('crypto').randomBytes(32).toString('base64'))"
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
    </div>
  );
}
