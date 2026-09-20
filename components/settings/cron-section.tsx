'use client';

/**
 * 定时任务设置分区（T12 文章定时发布 + 敏感密钥查看）
 *
 * 自持 cron 密钥的完整交互状态机：
 * - 查看明文：无密码触发新手引导（#18）→ 有密码弹二次验证框 → 验证通过展示明文
 * - 明文 30 秒倒计时自动隐藏（lib/settings/secret-reveal 纯 reducer）
 * - 输入框内 👁 显示/隐藏（type=password 语义）
 */
import { useEffect, useReducer, useState } from 'react';
import { Eye, EyeOff, Check, Copy } from 'lucide-react';
import type { CronSettings } from '@/lib/types/settings';
import { CronDeployPlatform } from '@/lib/types/settings';
import { emitGuideTrigger } from '@/lib/guides/client';
import { GUIDE_TRIGGER_EVENT } from '@/lib/guides/shared';
import { SecretRevealDialog } from '@/components/shared/secret-reveal-dialog';
import { usePasswordStatus, getAdminPathFromUrl } from '@/components/auth/use-password-status';
import { secretRevealReducer } from '@/lib/settings/shared';

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
const labelClass = 'block text-sm font-medium mb-1.5';

export function CronSection({
  cron,
  setCron,
}: {
  cron: CronSettings;
  setCron: (next: CronSettings) => void;
}) {
  // 敏感信息二次验证（#18）：cron.secret / cron.jobApiKey 查看明文
  const [revealDialog, setRevealDialog] = useState<{ key: string; label: string } | null>(null);
  const [revealed, dispatch] = useReducer(secretRevealReducer, null);
  const [copied, setCopied] = useState(false);
  // 账号是否已设置密码（无密码时点「查看」触发新手引导设置密码）
  const { hasPassword } = usePasswordStatus();
  // 输入内容显示/隐藏（👁）
  const [showCronSecret, setShowCronSecret] = useState(false);
  const [showCronJobApiKey, setShowCronJobApiKey] = useState(false);

  // 明文倒计时，到期自动隐藏（状态机收口在 reducer，组件只每秒 dispatch tick）
  useEffect(() => {
    if (!revealed) return;
    const timer = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(timer);
  }, [revealed]);

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
          console.error('点击查看已配置明文按钮', e);
          if (hasPassword === null) return; // 密码状态检测中：禁用，避免二次验证弹窗时有时无
          if (hasPassword === false) {
            // 无密码：触发新手引导（弹窗说明 + 按钮引导设置密码），不弹验证框
            emitGuideTrigger({
              event: GUIDE_TRIGGER_EVENT,
              target: 'reveal-view',
              page: '/settings',
              // 无密码账号主动点击「查看」→ 强制重新引导设置密码（无视进度 skipped 冷却）
              force: true,
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
      title={show ? '隐藏输入内容' : '显示输入内容'}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  /** cron 敏感字段明文展示条（倒计时自动隐藏） */
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
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? '已复制' : '复制'}
        </button>
        <span className="shrink-0 text-xs text-muted-foreground" title="到期自动隐藏">
          {revealed.countdown}s
        </span>
      </div>
    ) : null;

  return (
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
        <br />- <strong>VERCEL</strong>：使用 cron-job.org 外部定时任务（推荐，Vercel serverless
        无持久化进程）
        <br />- <strong>SERVER</strong>：使用 node-cron 内置定时任务（自有服务器时使用）
        <br />
        环境变量优先级更高（设置了对应环境变量则后台配置不生效）。
      </p>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>部署平台</label>
          <select
            className={`${inputClass} mt-1 w-full`}
            value={cron.deployPlatform}
            onChange={(e) =>
              setCron({ ...cron, deployPlatform: e.target.value as CronDeployPlatform })
            }
          >
            <option value={CronDeployPlatform.VERCEL}>VERCEL（cron-job.org 外部定时任务）</option>
            <option value={CronDeployPlatform.SERVER}>SERVER（node-cron 内置定时任务）</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            注意：应用启动时使用环境变量 DEPLOY_PLATFORM 决定是否启动
            node-cron，修改后需重启应用生效。
          </p>
        </div>
        <div>
          <label className={labelClass}>
            CRON_SECRET（定时任务接口鉴权密钥）
            {cron.secretConfigured && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已配置</span>
            )}
            {cronRevealButton('cron.secret', 'CRON_SECRET', cron.secretConfigured)}
          </label>
          <div className="relative">
            <input
              type={showCronSecret ? 'text' : 'password'}
              value={cron.secret}
              onChange={(e) => setCron({ ...cron, secret: e.target.value })}
              className={`${inputClass} pr-10`}
              placeholder={
                cron.secretConfigured
                  ? '留空则保持当前配置，输入新值则覆盖'
                  : '生成方式：openssl rand -hex 32'
              }
            />
            {eyeToggle(showCronSecret, () => setShowCronSecret((v) => !v))}
          </div>
          {cronRevealBanner('cron.secret', 'CRON_SECRET')}
          <p className="mt-1 text-xs text-muted-foreground">
            用于定时任务接口鉴权，AES-256-GCM 加密存储。修改后需重新创建 cron-job.org 定时任务（URL
            中编码了 secret）。
          </p>
        </div>
        <div>
          <label className={labelClass}>
            CRON_JOB_API_KEY（cron-job.org API Key）
            {cron.jobApiKeyConfigured && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ 已配置</span>
            )}
            {cronRevealButton('cron.jobApiKey', 'CRON_JOB_API_KEY', cron.jobApiKeyConfigured)}
          </label>
          <div className="relative">
            <input
              type={showCronJobApiKey ? 'text' : 'password'}
              value={cron.jobApiKey}
              onChange={(e) => setCron({ ...cron, jobApiKey: e.target.value })}
              className={`${inputClass} pr-10`}
              placeholder={
                cron.jobApiKeyConfigured
                  ? '留空则保持当前配置，输入新值则覆盖'
                  : '获取地址：https://cron-job.org/en/members/settings/'
              }
            />
            {eyeToggle(showCronJobApiKey, () => setShowCronJobApiKey((v) => !v))}
          </div>
          {cronRevealBanner('cron.jobApiKey', 'CRON_JOB_API_KEY')}
          <p className="mt-1 text-xs text-muted-foreground">
            VERCEL 模式下用于调用 cron-job.org API 创建/删除定时任务，AES-256-GCM 加密存储。
          </p>
        </div>
      </div>

      {/* 敏感信息二次验证弹窗（cron 密钥） */}
      <SecretRevealDialog
        open={!!revealDialog}
        fieldLabel={revealDialog?.label ?? ''}
        fieldKey={revealDialog?.key ?? ''}
        onClose={() => setRevealDialog(null)}
        onRevealed={(value) => {
          if (revealDialog) {
            dispatch({ type: 'reveal', key: revealDialog.key, value });
            setRevealDialog(null);
          }
        }}
      />
    </div>
  );
}
