"use client";

/**
 * 后台定时任务管理组件
 *
 * 功能：
 * - 获取定时任务状态（平台、配置状态、定时任务运行状态）
 * - 启动定时任务（创建 cron-job.org 定时任务）
 * - 停止定时任务（删除 cron-job.org 定时任务）
 * - 手动触发一次定时发布扫描
 *
 * 注意：这是独立的管理页面，不放在站点设置里
 */
import { useEffect, useState } from "react";
import { Play, Square, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/toast";

type CronStatus = {
  platform: "VERCEL" | "SERVER";
  cronSecretConfigured: boolean;
  cronJobApiKeyConfigured: boolean;
  siteUrl: string;
  job: {
    enabled: boolean;
    jobId?: number;
    nextRun?: number;
  };
  endpoints: {
    publishScheduled: string;
  };
};

type ActionType = "start" | "stop" | "run" | null;

export function ManageCron() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [action, setAction] = useState<ActionType>(null);

  // 加载状态
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

  useEffect(() => {
    loadStatus();
  }, []);

  // 执行操作
  const executeAction = async (type: ActionType) => {
    if (!type) return;
    setAction(type);
    try {
      const res = await fetch(`/api/admin/cron/${type}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "操作成功", "success");
        // 重新加载状态
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
      <div className="container mx-auto px-4 py-12">
        <div className="py-12 text-center text-sm text-muted-foreground">无法获取定时任务状态</div>
      </div>
    );
  }

  const isRunning = status.job.enabled;
  const canStart = status.platform === "VERCEL" && status.cronSecretConfigured && status.cronJobApiKeyConfigured && status.siteUrl;
  const canRun = status.cronSecretConfigured;

  return (
    <div className="container mx-auto px-4 py-8 animate-page-enter">
      <header className="mb-8">
        <p className="font-mono text-xs text-muted-foreground">后台管理</p>
        <h1 className="mt-1 text-2xl font-semibold">定时任务管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理文章定时发布任务，支持 VERCEL（cron-job.org）和 SERVER（node-cron）两种模式
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
            {status.platform === "VERCEL" ? "cron-job.org 外部定时任务" : "node-cron 内置定时任务"}
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

        {/* 定时任务状态 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isRunning ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
            <span>定时任务状态</span>
          </div>
          <p className="mt-2 text-lg font-semibold">
            {isRunning ? "运行中" : "未运行"}
          </p>
          {isRunning && status.job.nextRun && (
            <p className="mt-1 text-xs text-muted-foreground">
              下次执行：{new Date(status.job.nextRun).toLocaleString("zh-CN")}
            </p>
          )}
          {status.job.jobId && (
            <p className="mt-1 text-xs text-muted-foreground">任务 ID：{status.job.jobId}</p>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">操作</h2>
        <div className="flex flex-wrap gap-4">
          {/* 启动定时任务 */}
          <button
            type="button"
            onClick={() => executeAction("start")}
            disabled={action !== null || isRunning || !canStart}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action === "start" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            启动定时任务
          </button>

          {/* 停止定时任务 */}
          <button
            type="button"
            onClick={() => executeAction("stop")}
            disabled={action !== null || !isRunning}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action === "stop" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            停止定时任务
          </button>

          {/* 手动触发一次扫描 */}
          <button
            type="button"
            onClick={() => executeAction("run")}
            disabled={action !== null || !canRun}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action === "run" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            手动触发一次扫描
          </button>

          {/* 刷新状态 */}
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新状态
          </button>
        </div>

        {/* 提示信息 */}
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          {!canStart && status.platform === "VERCEL" && (
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-600" />
              <span>
                VERCEL 模式需要配置 CRON_SECRET、CRON_JOB_API_KEY 和 NEXT_PUBLIC_SITE_URL 才能启动定时任务。
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
              定时任务每分钟执行一次，扫描所有到期的定时文章并自动发布。
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
              <li>确保 NEXT_PUBLIC_SITE_URL 已配置（环境变量或站点设置）</li>
              <li>点击「启动定时任务」按钮，自动在 cron-job.org 创建定时任务</li>
              <li>定时任务每分钟执行一次，自动发布到期的文章</li>
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
