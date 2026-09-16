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
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/status";
import { CronDeployPlatform } from "@/lib/types/settings";
import { type CronJob, type CronJobConfig, type CronJobSchedule } from "@/lib/types/cron";
import {
  type FormState,
  DEFAULT_FORM,
  REQUEST_METHODS,
  TIMEZONES,
  jobToForm,
  formToConfig,
  formatScheduleArray,
} from "@/lib/cron/form";
import { CronJobHistoryDialog } from "@/components/cron-job-history";
import { matchPresetByUrl, matchSystemJob } from "@/lib/cron/system-jobs";

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
  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
  const openCreateForm = () => {
    setForm(DEFAULT_FORM);
    setEditingJobId(null);
    setShowForm(true);
    setShowAdvanced(false);
  };

  // 打开编辑表单
  const openEditForm = async (job: CronJob) => {
    setForm(jobToForm(job));
    setEditingJobId(job.jobId);
    setShowForm(true);
    setShowAdvanced(true);

    // 获取详细信息完整回填（含 url/schedule/headers/auth/notification），
    // 兼容系统任务：即使传入的 job 只有 jobId/title，也能正确打开编辑表单
    try {
      const res = await fetch(`/api/admin/cron/jobs/${job.jobId}`);
      if (res.ok) {
        const data = await res.json();
        const detailed = data.job;
        if (detailed) {
          setForm((prev) => ({
            ...prev,
            title: detailed.title || prev.title,
            url: detailed.url || prev.url,
            enabled: detailed.enabled ?? prev.enabled,
            saveResponses: detailed.saveResponses ?? prev.saveResponses,
            requestMethod: detailed.requestMethod ?? prev.requestMethod,
            requestTimeout: detailed.requestTimeout ?? prev.requestTimeout,
            redirectSuccess: detailed.redirectSuccess ?? prev.redirectSuccess,
            schedule: detailed.schedule
              ? {
                  timezone: detailed.schedule.timezone || "Asia/Shanghai",
                  minutes: formatScheduleArray(detailed.schedule.minutes),
                  hours: formatScheduleArray(detailed.schedule.hours),
                  mdays: formatScheduleArray(detailed.schedule.mdays),
                  months: formatScheduleArray(detailed.schedule.months),
                  wdays: formatScheduleArray(detailed.schedule.wdays),
                }
              : prev.schedule,
            headers: detailed.extendedData?.headers
              ? Object.entries(detailed.extendedData.headers).map(([key, value]) => ({
                  key,
                  value: value as string,
                }))
              : [],
            body: detailed.extendedData?.body || "",
            auth: detailed.auth
              ? {
                  enable: detailed.auth.enable ?? false,
                  user: detailed.auth.user || "",
                  password: detailed.auth.password || "",
                }
              : prev.auth,
            notification: detailed.notification
              ? {
                  onFailure: detailed.notification.onFailure ?? false,
                  onFailureCount: detailed.notification.onFailureCount ?? 1,
                  onSuccess: detailed.notification.onSuccess ?? false,
                  onDisable: detailed.notification.onDisable ?? false,
                  onSslCertExpiry: detailed.notification.onSslCertExpiry ?? false,
                  onSslCertExpirySeconds: detailed.notification.onSslCertExpirySeconds ?? 604800,
                }
              : prev.notification,
          }));
        }
      }
    } catch (e) {
      console.error("获取任务详情失败：", e);
    }
  };

  // 保存任务
  const saveJob = async () => {
    if (!form.url.trim()) {
      showToast("任务 URL 是必填项", "error");
      return;
    }

    setSaving(true);
    try {
      const config = formToConfig(form);
      const url = editingJobId
        ? `/api/admin/cron/jobs/${editingJobId}`
        : "/api/admin/cron/jobs";
      const method = editingJobId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: config }),
      });

      if (res.ok) {
        showToast(editingJobId ? "任务更新成功" : "任务创建成功", "success");
        setShowForm(false);
        setTimeout(() => loadJobs(), 500);
      } else {
        const data = await res.json();
        showToast(data.error || "保存失败", "error");
      }
    } catch (e) {
      console.error("保存任务失败：", e);
      showToast("保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

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

  const methodLabel = (method: number) =>
    REQUEST_METHODS.find((m) => m.value === method)?.label || `UNKNOWN(${method})`;

  // 系统任务在「系统定时任务」区统一管理，此处过滤掉避免重复
  // 孤儿系统任务：标题/URL 命中系统特征但匹配不到预设（标题被改动等）
  const SYSTEM_ROUTE_FRAGMENTS = ["/api/cron/backup", "/api/cron/publish-scheduled"];
  const isOrphanSystemJob = (job: CronJob) =>
    !matchSystemJob(job) &&
    (job.title.includes("[系统") ||
      job.title.includes("[blog:") ||
      SYSTEM_ROUTE_FRAGMENTS.some((f) => job.url.includes(f)));

  // 系统标签多色：按预设名 hash 稳定取色（同一预设恒定同色，不随渲染闪变）
  const SYSTEM_TAG_COLORS = [
    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  ];
  const systemTagColor = (name: string) => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return SYSTEM_TAG_COLORS[h % SYSTEM_TAG_COLORS.length];
  };

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
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
                    <th className="w-12 px-4 py-3 text-left text-sm font-medium text-muted-foreground">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">任务</th>
                    <th className="w-20 px-4 py-3 text-left text-sm font-medium text-muted-foreground">方法</th>
                    <th className="w-44 px-4 py-3 text-left text-sm font-medium text-muted-foreground">下次执行</th>
                    <th className="w-48 px-4 py-3 text-right text-sm font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => {
                    const preset = matchSystemJob(job);
                    const urlPreset = preset ?? matchPresetByUrl(job);
                    const orphan = !urlPreset && isOrphanSystemJob(job);
                    return (
                      <tr key={job.jobId} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex h-2 w-2 rounded-full ${
                              job.enabled ? "bg-green-500" : "bg-gray-400"
                            }`}
                            title={job.enabled ? "已启用" : "已禁用"}
                          />
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
                            {urlPreset ? (
                              <>
                                {job.enabled ? (
                                  <button
                                    type="button"
                                    onClick={() => executeAction("stop", urlPreset.key)}
                                    disabled={action !== null}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                                    title="停止（禁用，保留历史）"
                                  >
                                    {action?.key === urlPreset.key && action?.type === "stop" ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Square className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => executeAction("start", urlPreset.key)}
                                    disabled={action !== null}
                                    className="rounded-md p-1.5 text-green-600 transition-colors hover:bg-green-500/10 disabled:opacity-50"
                                    title="启动（按预设创建/启用）"
                                  >
                                    {action?.key === urlPreset.key && action?.type === "start" ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Play className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                {urlPreset.supportsRun && (
                                  <button
                                    type="button"
                                    onClick={() => executeAction("run", urlPreset.key)}
                                    disabled={action !== null}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
                                    title="手动触发"
                                  >
                                    {action?.key === urlPreset.key && action?.type === "run" ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleJob(job)}
                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title={job.enabled ? "禁用" : "启用"}
                              >
                                {job.enabled ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditForm(urlPreset ? ({ jobId: job.jobId, title: job.title, enabled: job.enabled } as CronJob) : job)}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="编辑"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryJob(job)}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="执行历史"
                            >
                              <HistoryIcon className="h-4 w-4" />
                            </button>
                            <button
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
                const preset = matchSystemJob(job);
                const urlPreset = preset ?? matchPresetByUrl(job);
                const orphan = !urlPreset && isOrphanSystemJob(job);
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
                      {urlPreset ? (
                        <>
                          {job.enabled ? (
                            <button
                              type="button"
                              onClick={() => executeAction("stop", urlPreset.key)}
                              disabled={action !== null}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                              title="停止（禁用，保留历史）"
                            >
                              {action?.key === urlPreset.key && action?.type === "stop" ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => executeAction("start", urlPreset.key)}
                              disabled={action !== null}
                              className="rounded-md p-1.5 text-green-600 transition-colors hover:bg-green-500/10 disabled:opacity-50"
                              title="启动（按预设创建/启用）"
                            >
                              {action?.key === urlPreset.key && action?.type === "start" ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {urlPreset.supportsRun && (
                            <button
                              type="button"
                              onClick={() => executeAction("run", urlPreset.key)}
                              disabled={action !== null}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
                              title="手动触发"
                            >
                              {action?.key === urlPreset.key && action?.type === "run" ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleJob(job)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title={job.enabled ? "禁用" : "启用"}
                        >
                          {job.enabled ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditForm(urlPreset ? ({ jobId: job.jobId, title: job.title, enabled: job.enabled } as CronJob) : job)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="编辑"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryJob(job)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="执行历史"
                      >
                        <HistoryIcon className="h-4 w-4" />
                      </button>
                      <button
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingJobId ? "编辑定时任务" : "创建定时任务"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 基本信息 */}
              <div>
                <label className="mb-1 block text-sm font-medium">任务标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="例如：博客定时发布扫描"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  请求 URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                  placeholder="https://example.com/api/cron/publish-scheduled"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">请求方法</label>
                  <select
                    value={form.requestMethod}
                    onChange={(e) => setForm({ ...form, requestMethod: parseInt(e.target.value, 10) })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {REQUEST_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">超时时间（秒）</label>
                  <input
                    type="number"
                    value={form.requestTimeout}
                    onChange={(e) => setForm({ ...form, requestTimeout: parseInt(e.target.value, 10) || -1 })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    placeholder="-1 表示使用默认"
                  />
                </div>
              </div>


              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  启用任务
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.saveResponses}
                    onChange={(e) => setForm({ ...form, saveResponses: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  保存响应
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.redirectSuccess}
                    onChange={(e) => setForm({ ...form, redirectSuccess: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  3xx 视为成功
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                开启「保存响应」后，执行历史中将保存并展示本次请求的响应头和响应体，便于排查问题。
                注意：响应内容可能包含敏感信息（如 API Key），请勿外泄。
              </p>

              {/* 调度配置 */}
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-3 font-medium">调度配置</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">时区</label>
                    <select
                      value={form.schedule.timezone}
                      onChange={(e) =>
                        setForm({ ...form, schedule: { ...form.schedule, timezone: e.target.value } })
                      }
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">分钟 (0-59, -1=每分)</label>
                      <input
                        type="text"
                        value={form.schedule.minutes}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, minutes: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">小时 (0-23, -1=每时)</label>
                      <input
                        type="text"
                        value={form.schedule.hours}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, hours: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">日 (1-31, -1=每天)</label>
                      <input
                        type="text"
                        value={form.schedule.mdays}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, mdays: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">月 (1-12, -1=每月)</label>
                      <input
                        type="text"
                        value={form.schedule.months}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, months: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">周几 (0-6, -1=每天)</label>
                      <input
                        type="text"
                        value={form.schedule.wdays}
                        onChange={(e) =>
                          setForm({ ...form, schedule: { ...form.schedule, wdays: e.target.value } })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="-1"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    多个值用逗号分隔，例如：0,15,30,45 表示每 15 分钟执行一次
                  </p>
                </div>
              </div>

              {/* 通知设置 */}
              <div className="rounded-lg border border-border p-4">
                <button
                  type="button"
                  onClick={() => setShowNotification(!showNotification)}
                  className="flex w-full items-center justify-between text-left font-medium"
                >
                  <span>通知设置</span>
                  {showNotification ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showNotification && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onFailure}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onFailure: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        失败时通知
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onSuccess}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onSuccess: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        成功后通知
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onDisable}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onDisable: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        自动禁用时通知
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.notification.onSslCertExpiry}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: { ...form.notification, onSslCertExpiry: e.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        SSL 证书即将过期时通知
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          失败多少次后通知（最小 1）
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={form.notification.onFailureCount}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: {
                                ...form.notification,
                                onFailureCount: parseInt(e.target.value, 10) || 1,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          disabled={!form.notification.onFailure}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          SSL 过期提前通知（秒，默认 604800 = 7 天）
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={form.notification.onSslCertExpirySeconds}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              notification: {
                                ...form.notification,
                                onSslCertExpirySeconds: parseInt(e.target.value, 10) || 0,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          disabled={!form.notification.onSslCertExpiry}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      通知通过 cron-job.org 发送到账号绑定的邮箱/渠道。失败多次通知需先开启「失败时通知」。
                    </p>
                  </div>
                )}
              </div>

              {/* 高级配置（请求头和请求体） */}
              <div className="rounded-lg border border-border p-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex w-full items-center justify-between text-left font-medium"
                >
                  <span>高级配置（请求头 / 请求体）</span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium">请求头</label>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, headers: [...form.headers, { key: "", value: "" }] })
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          + 添加请求头
                        </button>
                      </div>
                      <div className="space-y-2">
                        {form.headers.map((header, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={header.key}
                              onChange={(e) => {
                                const newHeaders = [...form.headers];
                                newHeaders[index].key = e.target.value;
                                setForm({ ...form, headers: newHeaders });
                              }}
                              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                              placeholder="Header Name"
                            />
                            <input
                              type="text"
                              value={header.value}
                              onChange={(e) => {
                                const newHeaders = [...form.headers];
                                newHeaders[index].value = e.target.value;
                                setForm({ ...form, headers: newHeaders });
                              }}
                              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                              placeholder="Header Value"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newHeaders = form.headers.filter((_, i) => i !== index);
                                setForm({ ...form, headers: newHeaders });
                              }}
                              className="rounded p-1 text-muted-foreground hover:text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">请求体</label>
                      <textarea
                        value={form.body}
                        onChange={(e) => setForm({ ...form, body: e.target.value })}
                        className="h-24 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                        placeholder='{"key": "value"}'
                      />
                    </div>

                    {/* HTTP 基本认证 */}
                    <div className="rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.auth.enable}
                          onChange={(e) =>
                            setForm({ ...form, auth: { ...form.auth, enable: e.target.checked } })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        HTTP 基本认证
                      </label>
                      {form.auth.enable && (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">用户名</label>
                            <input
                              type="text"
                              value={form.auth.user}
                              onChange={(e) =>
                                setForm({ ...form, auth: { ...form.auth, user: e.target.value } })
                              }
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Basic Auth 用户名"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">密码</label>
                            <input
                              type="password"
                              value={form.auth.password}
                              onChange={(e) =>
                                setForm({ ...form, auth: { ...form.auth, password: e.target.value } })
                              }
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Basic Auth 密码"
                            />
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        启用后请求会携带 Authorization: Basic 头。密码仅保存于 cron-job.org，用于执行时认证。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 表单底部按钮 */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveJob}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "保存中..." : editingJobId ? "保存修改" : "创建任务"}
              </button>
            </div>
          </div>
        </div>
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
