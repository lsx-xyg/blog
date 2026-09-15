"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye } from "lucide-react";
import { STORAGE_DRIVER_VALUES, StorageDriverType } from "@/lib/types/storage";
import type { StorageSettings } from "@/lib/types/settings";
import { SecretRevealDialog } from "@/components/secret-reveal-dialog";
import { usePasswordStatus, getAdminPathFromUrl } from "@/components/use-password-status";

interface StorageConfigFormProps {
  storage: StorageSettings;
  setStorage: React.Dispatch<React.SetStateAction<StorageSettings>>;
  /** 是否为私有存储配置（用于显示不同的提示文案） */
  isPrivate?: boolean;
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all";
const labelClass = "block text-sm font-medium mb-1.5";

/** 敏感信息字段 key 前缀（与后端 SECRET_KEYS 白名单对应） */
const secretPrefix = (isPrivate: boolean) =>
  isPrivate ? "storage_private" : "storage";

/** 明文展示时长（秒） */
const REVEAL_SECONDS = 30;

/**
 * 存储配置表单组件
 * 用于公开存储和私有存储的配置，根据 isPrivate 显示不同的提示文案
 * 敏感字段（GitHub Token / S3 Access Key / Secret Key）支持二次验证后临时查看明文（#18）
 */
export function StorageConfigForm({ storage, setStorage, isPrivate = false }: StorageConfigFormProps) {
  // 二次验证弹窗状态（#18）
  const [revealDialog, setRevealDialog] = useState<{ key: string; label: string } | null>(null);
  // 已通过验证正在展示的明文（不写入表单 state，30 秒后自动隐藏）
  const [revealed, setRevealed] = useState<{ key: string; value: string } | null>(null);
  const [countdown, setCountdown] = useState(REVEAL_SECONDS);
  const [copied, setCopied] = useState(false);
  // 账号是否已设置密码（无密码时点「查看」直接引导设置密码页）
  const { hasPassword } = usePasswordStatus();

  // 明文 30 秒倒计时，到期自动隐藏
  useEffect(() => {
    if (!revealed) return;
    setCountdown(REVEAL_SECONDS);
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [revealed]);

  // 倒计时归零后自动隐藏明文
  useEffect(() => {
    if (revealed && countdown <= 0) {
      setRevealed(null);
    }
  }, [countdown, revealed]);

  // 复制明文到剪贴板
  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  /** 已配置敏感字段的「查看明文」按钮；无密码账号直接引导设置密码页 */
  const revealButton = (key: string, label: string, configured?: boolean) =>
    configured ? (
      <button
        type="button"
        onClick={() => {
          if (hasPassword === false) {
            window.location.href = `/${getAdminPathFromUrl()}/account`;
            return;
          }
          setRevealDialog({ key, label });
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        title="验证后查看明文"
      >
        <Eye className="h-3.5 w-3.5" />
        查看
      </button>
    ) : null;

  /** 明文展示条（30 秒自动隐藏，grid 布局下跨两列显示） */
  const revealBanner = (key: string, label: string) =>
    revealed?.key === key ? (
      <div className="md:col-span-2 mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
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

  return (
    <div className="space-y-6">
      {/* 无密码提示：敏感信息查看前需先设置密码 */}
      {hasPassword === false && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          当前账号未设置密码（通过 GitHub 登录创建），敏感信息查看前需要先设置密码。
          <a
            href={`/${getAdminPathFromUrl()}/account`}
            className="ml-1 font-medium underline underline-offset-2"
          >
            前往设置密码 →
          </a>
        </div>
      )}

      {/* 当前驱动 */}
      <div>
        <label className={labelClass}>当前存储驱动</label>
        <div className="flex gap-2 flex-wrap">
          {STORAGE_DRIVER_VALUES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setStorage({ ...storage, driver: d })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${storage.driver === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
            >
              {d === StorageDriverType.LOCAL
                ? "本地存储"
                : d === StorageDriverType.GITHUB
                  ? isPrivate
                    ? "GitHub 私有仓库"
                    : "GitHub 公开仓库"
                  : "S3 兼容存储"}
            </button>
          ))}
        </div>
      </div>

      {/* GitHub 配置 */}
      {storage.driver === StorageDriverType.GITHUB && (
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <h3 className="font-medium text-sm">
            GitHub {isPrivate ? "私有仓库" : "公开仓库"}配置
          </h3>
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
                placeholder={isPrivate ? "backups" : "public"}
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
              <label className={labelClass}>
                子目录（Directory，可选）
              </label>
              <input
                type="text"
                value={storage.github.directory}
                onChange={(e) => setStorage({ ...storage, github: { ...storage.github, directory: e.target.value } })}
                className={inputClass}
                placeholder={isPrivate ? "backups" : "uploads（留空则存根目录）"}
              />
            </div>
            {!isPrivate && (
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
            )}
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
                  className={`${inputClass} pr-14`}
                  placeholder={storage.github.tokenConfigured ? "留空则保持当前配置，输入新值则覆盖" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                />
                {revealButton(`${secretPrefix(isPrivate)}.github.token`, "GitHub Token", storage.github.tokenConfigured)}
              </div>
              {revealBanner(`${secretPrefix(isPrivate)}.github.token`, "GitHub Token")}
              <p className="mt-1 text-xs text-muted-foreground">
                需要 repo 权限。加密存储在数据库中，环境变量 {isPrivate ? "GITHUB_PRIVATE_TOKEN" : "GITHUB_STORAGE_TOKEN"} 优先级更高。
              </p>
            </div>
          </div>
          {!isPrivate && (
            <p className="text-xs text-muted-foreground">
              访问 URL 格式：{storage.github.cdnBase || "https://cdn.jsdelivr.net/gh"}/{storage.github.owner || "owner"}/{storage.github.repo || "repo"}@{storage.github.branch || "main"}/{storage.github.directory ? storage.github.directory + "/" : ""}{'{path}'}
            </p>
          )}
          {isPrivate && (
            <p className="text-xs text-muted-foreground">
              私有仓库只有仓库所有者可访问，备份文件不会公开。建议使用独立的 Token，权限最小化。
            </p>
          )}
        </div>
      )}

      {/* S3 配置 */}
      {storage.driver === StorageDriverType.S3 && (
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <h3 className="font-medium text-sm">S3 兼容存储配置（{isPrivate ? "私有 bucket" : "公开 bucket"}）</h3>
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
                placeholder={isPrivate ? "my-private-bucket" : "my-public-bucket"}
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
              <label className={labelClass}>子目录（Directory，可选）</label>
              <input
                type="text"
                value={storage.s3.directory}
                onChange={(e) => setStorage({ ...storage, s3: { ...storage.s3, directory: e.target.value } })}
                className={inputClass}
                placeholder={isPrivate ? "backups" : "uploads（留空则存根目录）"}
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
                className={`${inputClass} pr-14`}
                placeholder={storage.s3.accessKeyConfigured ? "留空则保持当前配置" : "AKIAxxxxxxxxxxxxxxxx"}
              />
              {revealButton(`${secretPrefix(isPrivate)}.s3.accessKey`, "Access Key ID", storage.s3.accessKeyConfigured)}
            </div>
            {revealBanner(`${secretPrefix(isPrivate)}.s3.accessKey`, "Access Key ID")}
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
                className={`${inputClass} pr-14`}
                placeholder={storage.s3.secretKeyConfigured ? "留空则保持当前配置" : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              />
              {revealButton(`${secretPrefix(isPrivate)}.s3.secretKey`, "Secret Access Key", storage.s3.secretKeyConfigured)}
            </div>
            {revealBanner(`${secretPrefix(isPrivate)}.s3.secretKey`, "Secret Access Key")}
          </div>
          <p className="text-xs text-muted-foreground">
            敏感信息加密存储在数据库中，环境变量 {isPrivate ? "S3_PRIVATE_ACCESS_KEY / S3_PRIVATE_SECRET_KEY" : "S3_ACCESS_KEY / S3_SECRET_KEY"} 优先级更高。
            {isPrivate && " 私有 bucket 建议开启服务端加密（SSE-S3 或 SSE-KMS）。"}
          </p>
        </div>
      )}

      {/* LOCAL 配置 */}
      {storage.driver === StorageDriverType.LOCAL && (
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <h3 className="font-medium text-sm">本地存储配置（{isPrivate ? "私有目录" : "公开目录"}）</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                {isPrivate ? "私有目录（相对于项目根目录，不暴露到 Web）" : "上传目录（相对于项目根目录，可通过 HTTP 访问）"}
              </label>
              <input
                type="text"
                value={storage.local.uploadDir}
                onChange={(e) => setStorage({ ...storage, local: { ...storage.local, uploadDir: e.target.value } })}
                className={inputClass}
                placeholder={isPrivate ? "private/storage" : "public/uploads"}
              />
            </div>
            <div>
              <label className={labelClass}>子目录（Directory，可选）</label>
              <input
                type="text"
                value={storage.local.directory}
                onChange={(e) => setStorage({ ...storage, local: { ...storage.local, directory: e.target.value } })}
                className={inputClass}
                placeholder={isPrivate ? "backups" : "uploads（留空则存根目录）"}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isPrivate
              ? "私有目录不会暴露到 Web，只能通过后台 API 下载。适用于存储备份等敏感数据。"
              : "注意：本地存储仅适用于开发环境。Vercel 等 Serverless 平台无持久化文件系统，生产环境请使用 GitHub 或 S3。"}
          </p>
        </div>
      )}

      {/* 敏感信息二次验证弹窗（#18 方案 C：管理员密码验证） */}
      <SecretRevealDialog
        open={!!revealDialog}
        fieldLabel={revealDialog?.label ?? ""}
        fieldKey={revealDialog?.key ?? ""}
        onClose={() => setRevealDialog(null)}
        onRevealed={(value) => {
          if (revealDialog) {
            setRevealed({ key: revealDialog.key, value });
          }
        }}
      />
    </div>
  );
}
