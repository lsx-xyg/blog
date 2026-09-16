"use client";

/**
 * 后台定时任务管理组件（总览）
 *
 * 功能：
 * - 加载系统定时任务状态（平台、配置状态、系统任务运行状态）
 * - 启动/停止系统定时任务（预设驱动，启停 = PATCH enabled，保留任务与历史）
 * - 手动触发一次定时发布扫描
 * - 删除系统任务（彻底删除，任务列表同源）
 *
 * 注意：这是独立的管理页面，不放在站点设置里。
 * 配额约束：页面打开零请求，由按钮按需加载（免费版 cron-job.org API 每日 100 次）。
 */
import { useState } from "react";
import { Play, Square, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { CronDeployPlatform } from "@/lib/types/settings";

type SystemJobStatus = {
  key: string;
  name: string;
  description: string;
  supportsRun: boolean;
  enabled: boolean;
  jobId?: number;
  nextRun?: number | null;
};

type CronStatus = {
  platform: CronDeployPlatform;
  cronSecretConfigured: boolean;
  cronJobApiKeyConfigured: boolean;
  siteUrl: string;
  systemJobs: SystemJobStatus[];
  endpoints: {
    publishScheduled: string;
  };
};

type ActionState = { type: "start" | "stop" | "run" | "delete"; key: string } | null;

export function ManageCron() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [action, setAction] = useState<ActionState>(null);

  // 手动加载状态（页面打开不自动请求）
  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cron");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("获取定时任务状态失败：", e);
      showToast("获取定时任务状态失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 执行系统任务操作（每个操作 1 个 API）
  const executeAction = async (type: "start" | "stop" | "run" | "delete", job: SystemJobStatus) => {
    setAction({ type, key: job.key });
    try {
      let res: Response;
      if (type === "delete") {
        if (!job.jobId) {
          showToast("任务不存在", "error");
          return;
        }
        if (!confirm(`确定彻底删除系统任务「${job.name}」吗？删除后执行历史将丢失。`)) return;
        res = await fetch(`/api/admin/cron/jobs/${job.jobId}`, { method: "DELETE" });
      } else if (type === "run") {
        res = await fetch(`/api/admin/cron/${type}`, { method: "POST" });
      } else {
        res = await fetch(`/api/admin/cron/${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: job.key }),
        });
      }

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "操作成功", "success");
        setTimeout(() => loadStatus(), 500);
      } else {
        showToast(data.error || "操作失败", "error");
      }
    } catch (e) {
      console.error("操作失败：", e);
      showToast("操作失败，请重试", "error");
    } finally {
      setAction(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">加载中…</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="container mx-auto px-4 py-8 animate-page-enter">
        <header className="mb-8">
          <p className="font-mono text-xs text-muted-foreground">后台管理</p>
          <h1 className="mt-1 text-2xl font-semibold">定时任务管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理文章定时发布任务，支持 VERCEL（cron-job.org）和 SERVER（node-cron）两种模式
          </p>
        </header>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-base font-medium">尚未加载定时任务状态</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            免费版 cron-job.org API 每日配额有限（100 次），页面打开不会自动请求。点击下方按钮按需加载。
          </p>
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            加载状态
          </button>
        </div>
      </div>
    );
  }

  const runningCount = status.systemJobs.filter((j) => j.enabled).length;
  const canManage = status.cronJobApiKeyConfigured && status.cronSecretConfigured && status.siteUrl;

  return (
    <div className="container mx-auto px-4 py-8 animate-page-enter">
      <header className="mb-8">
        <p className="font-mono text-xs text-muted-foreground">后台管理</p>
        <h1 className="mt-1 text-2xl font-semibold">定时任务管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理站点系统定时任务，支持 VERCEL（cron-job.org）和 SERVER（node-cron）两种模式
        </p>
      </header>

      {/* 状态概览 */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 部署平台 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>部署平台</span>
          </div>
          <p className="mt-2 text-lg font-semibold">{status.platform}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {status.platform === CronDeployPlatform.VERCEL ? "cron-job.org 外部定时任务" : "node-cron 内置定时任务"}
          </p>
        </div>

        {/* CRON_SECRET */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {status.cronSecretConfigured ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span>CRON_SECRET</span>
          </div>
          <p className="mt-2 text-lg font-semibold">
            {status.cronSecretConfigured ? "已配置" : "未配置"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">定时任务接口鉴权密钥</p>
        </div>

        {/* CRON_JOB_API_KEY */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {status.cronJobApiKeyConfigured ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span>CRON_JOB_API_KEY</span>
          </div>
          <p className="mt-2 text-lg font-semibold">
            {status.cronJobApiKeyConfigured ? "已配置" : "未配置"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">cron-job.org API Key（VERCEL 模式需要）</p>
        </div>

        {/* 系统任务状态汇总 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {runningCount > 0 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
            <span>系统定时任务</span>
          </div>
          <p className="mt-2 text-lg font-semibold">
            {runningCount} / {status.systemJobs.length} 运行中
          </p>
          <p className="mt-1 text-xs text-muted-foreground">启停见下方系统任务列表</p>
        </div>
      </div>

      {/* 系统任务列表 */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">系统定时任务</h2>
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新状态
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          站点功能依赖的定时任务，由预设配置驱动创建。停止只是禁用（保留任务与执行历史），删除才是彻底移除。
        </p>

        {status.systemJobs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {status.platform === CronDeployPlatform.VERCEL && !status.cronJobApiKeyConfigured
              ? "CRON_JOB_API_KEY 未配置，无法加载系统任务状态"
              : "暂无系统任务，请刷新状态后重试"}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {status.systemJobs.map((job) => {
              const isActing = action?.key === job.key;
              return (
                <div key={job.key} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-2 w-2 flex-shrink-0 rounded-full ${
                          job.enabled ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      <h3 className="font-medium">{job.name}</h3>
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {job.enabled ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-600" /> 运行中
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-yellow-600" /> 未运行
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{job.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {job.nextRun && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          下次执行：{new Date(job.nextRun * 1000).toLocaleString("zh-CN")}
                        </span>
                      )}
                      {job.jobId && <span>任务 ID：{job.jobId}</span>}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {job.enabled ? (
                      <button
                        type="button"
                        onClick={() => executeAction("stop", job)}
                        disabled={action !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
                      >
                        {isActing && action?.type === "stop" ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        停止
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => executeAction("start", job)}
                        disabled={action !== null || !canManage}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isActing && action?.type === "start" ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        启动
                      </button>
                    )}
                    {job.supportsRun && (
                      <button
                        type="button"
                        onClick={() => executeAction("run", job)}
                        disabled={action !== null}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isActing && action?.type === "run" ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        手动触发
                      </button>
                    )}
                    {job.jobId && (
                      <button
                        type="button"
                        onClick={() => executeAction("delete", job)}
                        disabled={action !== null}
                        title="彻底删除（保留请用停止）"
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {isActing && action?.type === "delete" ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 提示信息 */}
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          {!canManage && status.platform === CronDeployPlatform.VERCEL && (
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-600" />
              <span>
                VERCEL 模式需要配置 CRON_SECRET、CRON_JOB_API_KEY 和站点 URL 才能启动系统任务。
                请在「设置 → 定时任务」中配置。
              </span>
            </p>
          )}
          {status.platform === "SERVER" && (
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-600" />
              <span>
                SERVER 模式：node-cron 内置定时任务已在应用启动时自动运行，无需手动启动/停止。
                如需禁用，请在环境变量中设置 DEPLOY_PLATFORM=VERCEL 并重启应用。
              </span>
            </p>
          )}
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span>
              定时发布扫描每分钟执行一次，扫描所有到期的定时文章并自动发布。
              扫描接口：<code className="rounded bg-muted px-1 py-0.5">{status.endpoints.publishScheduled}</code>
            </span>
          </p>
        </div>
      </div>

      {/* 配置说明 */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">配置说明</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium">VERCEL 模式（推荐）</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>在「设置 → 定时任务」中配置 CRON_SECRET 和 CRON_JOB_API_KEY</li>
              <li>确保站点 URL 已配置（环境变量或站点设置）</li>
              <li>在「系统定时任务」列表点击「启动」，自动按预设创建 cron-job.org 任务</li>
              <li>停止只是禁用任务（保留执行历史），可随时再启动</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium">SERVER 模式</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>在环境变量中设置 DEPLOY_PLATFORM=SERVER</li>
              <li>配置 CRON_SECRET（用于接口鉴权）</li>
              <li>重启应用，node-cron 内置定时任务会自动启动</li>
              <li>定时任务每分钟执行一次，自动发布到期的文章</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
