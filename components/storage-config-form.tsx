"use client";

import { STORAGE_DRIVER_VALUES, StorageDriverType } from "@/lib/types/storage";
import type { StorageSettings } from "@/lib/types/settings";

interface StorageConfigFormProps {
  storage: StorageSettings;
  setStorage: React.Dispatch<React.SetStateAction<StorageSettings>>;
  /** 是否为私有存储配置（用于显示不同的提示文案） */
  isPrivate?: boolean;
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all";
const labelClass = "block text-sm font-medium mb-1.5";

/**
 * 存储配置表单组件
 * 用于公开存储和私有存储的配置，根据 isPrivate 显示不同的提示文案
 */
export function StorageConfigForm({ storage, setStorage, isPrivate = false }: StorageConfigFormProps) {
  return (
    <div className="space-y-6">
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
                  className={`${inputClass} pr-12`}
                  placeholder={storage.github.tokenConfigured ? "留空则保持当前配置，输入新值则覆盖" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                />
                <button
                  type="button"
                  onClick={() => {
                    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
                    inputs.forEach((input) => {
                      input.type = input.type === "password" ? "text" : "password";
                    });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  👁
                </button>
              </div>
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
    </div>
  );
}
