"use client";

/**
 * 后台定时任务管理组件（增强版）
 *
 * 功能：
 * - 任务列表（展示所有 cron-job.org 定时任务）
 * - 创建任务（高级配置表单）
 * - 编辑任务
 * - 删除任务
 * - 启用/禁用任务
 * - 全局定时发布任务快速操作
 *
 * 参照 cron-job.org 官方界面设计
 */
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Square,
  RefreshCw,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  History as HistoryIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useCronForm } from "@/components/cron/use-cron-form";
import { CronJobFormDialog } from "@/components/cron/cron-job-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/status";
import { CronDeployPlatform } from "@/lib/types/settings";
import { type CronJob, type CronJobConfig, type CronJobSchedule } from "@/lib/types/cron";

import { CronJobHistoryDialog } from "@/components/cron/cron-job-history";
import {
  classifyJob,
  systemTagColor,
  methodLabel,
  availableActions,
  type JobClassification,
} from "@/lib/cron/client";

type CronStatus = {
  platform: CronDeployPlatform;
  cronSecretConfigured: boolean;
  cronJobApiKeyConfigured: boolean;
  siteUrl: string;
  systemJobs: Array<{
    key: string;
    name: string;
    description: string;
    supportsRun: boolean;
    enabled: boolean;
    jobId?: number;
    nextRun?: number | null;
  }>;
  endpoints: {
    publishScheduled: string;
  };
};


export function ManageCronJobs() {
  const { showToast } = useToast();
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobs, setJobs] = useState<CronJob[] | null>(null);
  const [action, setAction] = useState<{ key: string; type: "start" | "stop" | "run" } | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);

  // 页面打开不自动请求（免费版 cron-job.org API 每日配额有限），各按钮独立触发对应 API
  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/admin/cron/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error("加载任务列表失败：", e);
      showToast("加载任务列表失败", "error");
    } finally {
      setLoadingJobs(false);
    }
  };

  // 刷新：一次性加载全部任务（合并后仅一个 API）
  const refreshAll = async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/admin/cron/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error("刷新失败：", e);
      showToast("刷新失败", "error");
    } finally {
      setLoadingJobs(false);
    }
  };

  // 执行全局操作（成功后只刷新状态，1 个 API）
  const executeAction = async (type: "start" | "stop" | "run", jobKey?: string) => {
    setAction(jobKey ? { key: jobKey, type } : null);
    try {
      const res = await fetch(`/api/admin/cron/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: jobKey }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "操作成功", "success");
        setTimeout(() => loadJobs(), 500);
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

  // 打开创建表单
  // 删除确认对话框受控状态
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  // 删除任务
  const deleteJob = async (jobId: number) => {
    setConfirmState({
      title: "删除这个定时任务",
      onConfirm: async () => {
        setConfirmState(null);
        await doDeleteJob(jobId);
      },
    });
  };

  const doDeleteJob = async (jobId: number) => {
    try {
      const res = await fetch(`/api/admin/cron/jobs/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("任务删除成功", "success");
        setTimeout(() => loadJobs(), 500);
      } else {
        showToast("删除失败", "error");
      }
    } catch (e) {
      console.error("删除任务失败：", e);
      showToast("删除失败，请重试", "error");
    }
  };

  // 删除系统任务（系统任务区入口，删除后刷新状态）
  const deleteSystemJob = async (jobId: number, name: string) => {
    setConfirmState({
      title: `彻底删除系统任务「${name}」`,
      description: "删除后执行历史将丢失。",
      onConfirm: async () => {
        setConfirmState(null);
        await doDeleteSystemJob(jobId);
      },
    });
  };

  const doDeleteSystemJob = async (jobId: number) => {
    try {
      const res = await fetch(`/api/admin/cron/jobs/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("系统任务已删除", "success");
        setTimeout(() => loadJobs(), 500);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "删除失败", "error");
      }
    } catch (e) {
      console.error("删除系统任务失败：", e);
      showToast("删除失败，请重试", "error");
    }
  };

  // 切换任务启用状态
  const toggleJob = async (job: CronJob) => {
    try {
      const res = await fetch(`/api/admin/cron/jobs/${job.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: { enabled: !job.enabled } }),
      });
      if (res.ok) {
        showToast(job.enabled ? "任务已禁用" : "任务已启用", "success");
        setTimeout(() => loadJobs(), 500);
      } else {
        showToast("操作失败", "error");
      }
    } catch (e) {
      console.error("切换任务状态失败：", e);
      showToast("操作失败，请重试", "error");
    }
  };

  /** 任务操作按钮组（桌面表格 / 移动卡片共用；动作集合与顺序收口在 lib/cron/jobs.availableActions） */
  const renderActions = (job: CronJob, cls: JobClassification) => {
    const { urlPreset } = cls;
    const presetKey = urlPreset?.key;
    return (
      <>
        {availableActions(job, cls).map((a) => {
          switch (a) {
            case "start":
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => executeAction("start", presetKey)}
                  disabled={action !== null}
                  className="rounded-md p-1.5 text-green-600 transition-colors hover:bg-green-500/10 disabled:opacity-50"
                  title="启动（按预设创建/启用）"
                >
                  {action?.key === presetKey && action?.type === "start" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>
              );
            case "stop":
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => executeAction("stop", presetKey)}
                  disabled={action !== null}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  title="停止（禁用，保留历史）"
                >
                  {action?.key === presetKey && action?.type === "stop" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              );
            case "run":
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => executeAction("run", presetKey)}
                  disabled={action !== null}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
                  title="手动触发"
                >
                  {action?.key === presetKey && action?.type === "run" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
              );
            case "toggle":
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleJob(job)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={job.enabled ? "禁用" : "启用"}
                >
                  {job.enabled ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
              );
            case "edit":
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    openEditForm(
                      urlPreset
                        ? ({ jobId: job.jobId, title: job.title, enabled: job.enabled } as CronJob)
                        : job
                    )
                  }
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="编辑"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              );
            case "history":
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setHistoryJob(job)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="执行历史"
                >
                  <HistoryIcon className="h-4 w-4" />
                </button>
              );
            case "delete":
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    urlPreset
                      ? deleteSystemJob(job.jobId, job.title || urlPreset.name)
                      : deleteJob(job.jobId)
                  }
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                  title={urlPreset ? "彻底删除（保留请用停止）" : "删除"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              );
            default:
              return null;
          }
        })}
      </>
    );
  };

  const {
    form,
    setForm,
    showForm,
    editingJobId,
    saving,
    showAdvanced,
    setShowAdvanced,
    openCreateForm,
    openEditForm,
    saveJob,
    closeForm,
  } = useCronForm({ onSaved: loadJobs });

  return (
    <div className="animate-page-enter">
      <AdminPageHeader
        title="定时任务管理"
        description="系统任务（[blog:key] 预设驱动）与自建任务统一列表管理，一次加载全部"
        actions={
          <>
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">创建任务</span>
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={loadingJobs}
              title="加载 / 刷新全部任务（免费配额有限，按需使用）"
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingJobs ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">刷新</span>
            </button>
          </>
        }
      />

      {/* 任务列表：桌面表格 + 移动卡片（一次加载全部，系统任务带标签） */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">定时任务</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {jobs === null ? "未加载，点击右上角「刷新」加载" : `共 ${jobs.length} 个任务`} · 系统任务带预设标签
          </p>
        </div>

        {loadingJobs ? (
          <AdminLoadingState />
        ) : jobs === null ? (
          <AdminEmptyState
            title="任务列表尚未加载"
            description="免费版 cron-job.org API 每日配额有限（100 次），点击右上角「刷新」按需加载"
          />
        ) : jobs.length === 0 ? (
          <AdminEmptyState
            title="暂无定时任务"
            description="点击右上角「创建任务」开始"
          />
        ) : (
          <>
            {/* 桌面表格 */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">任务</th>
                    <th className="w-20 px-4 py-3 text-left text-sm font-medium text-muted-foreground">方法</th>
                    <th className="w-44 px-4 py-3 text-left text-sm font-medium text-muted-foreground">下次执行</th>
                    <th className="w-48 px-4 py-3 text-right text-sm font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => {
                    const cls = classifyJob(job);
                    const { preset, urlPreset, orphan } = cls;
                    return (
                      <tr key={job.jobId} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-none ${
                              job.enabled
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                            title={job.enabled ? "已启用" : "已禁用"}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                job.enabled ? "bg-green-500" : "bg-gray-400"
                              }`}
                            />
                            {job.enabled ? "运行中" : "未运行"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="max-w-[280px] truncate text-sm font-medium">{job.title || "(无标题)"}</span>
                            {urlPreset ? (
                              <span
                                title={
                                  preset
                                    ? `${urlPreset.name}（预设驱动）`
                                    : "URL 命中系统接口，但标题未按 [blog:key] 规范。可在操作中重新「启动」自动修复标题。"
                                }
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${systemTagColor(urlPreset.name)}`}
                              >
                                {urlPreset.name}
                              </span>
                            ) : orphan ? (
                              <span
                                title="标题或 URL 命中系统任务特征，但无法匹配任何预设。可在操作中重新「启动」自动修复。"
                                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                疑似系统任务
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-xs text-fg-faint">{job.url}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {methodLabel(job.requestMethod)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {job.nextExecution
                            ? new Date(job.nextExecution * 1000).toLocaleString("zh-CN")
                            : "无预测"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
              {renderActions(job, cls)}
            </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 移动卡片 */}
            <div className="md:hidden divide-y divide-border">
              {jobs.map((job, index) => {
                const cls = classifyJob(job);
                const { preset, urlPreset, orphan } = cls;
                return (
                  <div
                    key={job.jobId}
                    style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                    className="animate-fade-in-up px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    {/* 数据区 */}
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full ${
                          job.enabled ? "bg-green-500" : "bg-gray-400"
                        }`}
                        title={job.enabled ? "已启用" : "已禁用"}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 truncate text-sm font-medium">{job.title || "(无标题)"}</h3>
                          {urlPreset ? (
                            <span
                              title={
                                preset
                                  ? `${urlPreset.name}（预设驱动）`
                                  : "URL 命中系统接口，但标题未按 [blog:key] 规范。可重新「启动」自动修复标题。"
                              }
                              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${systemTagColor(urlPreset.name)}`}
                            >
                              {urlPreset.name}
                            </span>
                          ) : orphan ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              疑似系统任务
                            </span>
                          ) : null}
                          <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {methodLabel(job.requestMethod)}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-fg-faint">{job.url}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {job.nextExecution
                            ? `下次：${new Date(job.nextExecution * 1000).toLocaleString("zh-CN")}`
                            : "无预测"}
                          {job.lastExecution > 0 &&
                            ` · 上次：${new Date(job.lastExecution * 1000).toLocaleString("zh-CN")}`}
                        </p>
                      </div>
                    </div>
                    {/* 操作区：放数据下方 */}
                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/50 pt-2">
              {renderActions(job, cls)}
              </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 配置说明（折叠） */}
      <details className="group mt-8 rounded-xl border border-border bg-card p-4">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
          <span>配置说明与部署模式</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <h3 className="font-medium">VERCEL 模式（推荐）</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>在「设置 → 定时任务」中配置 CRON_SECRET 和 CRON_JOB_API_KEY</li>
              <li>确保站点 URL 已配置（环境变量或站点设置）</li>
              <li>在任务列表的系统任务行点击「启动」，自动按预设创建 cron-job.org 任务</li>
              <li>停止只是禁用任务（保留执行历史），可随时再启动；删除才是彻底移除</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium">SERVER 模式</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>在环境变量中设置 DEPLOY_PLATFORM=SERVER</li>
              <li>配置 CRON_SECRET（用于接口鉴权）</li>
              <li>重启应用，node-cron 内置定时任务会自动启动，无需手动管理</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium">配额说明</h3>
            <p className="mt-2 text-muted-foreground">
              免费版 cron-job.org API 每日 100 次。页面打开零请求；「加载任务列表 / 刷新」消耗 1 次，请按需使用。
            </p>
          </div>
        </div>
      </details>

      {/* 创建/编辑表单弹窗 */}
      {showForm && (
      <CronJobFormDialog
        form={form}
        setForm={setForm}
        editingJobId={editingJobId}
        saving={saving}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        onClose={closeForm}
        onSave={saveJob}
      />
      )}
      {/* 执行历史弹窗 */}
      {historyJob && (
        <CronJobHistoryDialog
          jobId={historyJob.jobId}
          jobTitle={historyJob.title || "(无标题)"}
          open={historyJob !== null}
          onClose={() => setHistoryJob(null)}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmLabel="删除"
        onConfirm={confirmState?.onConfirm ?? (() => {})}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
