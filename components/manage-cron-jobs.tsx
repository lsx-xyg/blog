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
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  History as HistoryIcon,
  Folder as FolderIcon,
  FolderPlus,
  Settings2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { CronDeployPlatform } from "@/lib/types/settings";
import { RequestMethod, type CronJob, type CronJobConfig, type CronJobSchedule, type CronFolder } from "@/lib/types/cron";
import { CronJobHistoryDialog } from "@/components/cron-job-history";

type CronStatus = {
  platform: CronDeployPlatform;
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

type FormState = {
  title: string;
  url: string;
  enabled: boolean;
  saveResponses: boolean;
  requestMethod: number;
  requestTimeout: number;
  redirectSuccess: boolean;
  headers: Array<{ key: string; value: string }>;
  body: string;
  schedule: {
    timezone: string;
    minutes: string;
    hours: string;
    mdays: string;
    months: string;
    wdays: string;
  };
  auth: {
    enable: boolean;
    user: string;
    password: string;
  };
  notification: {
    onFailure: boolean;
    onFailureCount: number;
    onSuccess: boolean;
    onDisable: boolean;
    onSslCertExpiry: boolean;
    onSslCertExpirySeconds: number;
  };
  folderId: number;
};

const DEFAULT_FORM: FormState = {
  title: "",
  url: "",
  enabled: true,
  saveResponses: false,
  requestMethod: RequestMethod.GET,
  requestTimeout: -1,
  redirectSuccess: false,
  headers: [],
  body: "",
  schedule: {
    timezone: "Asia/Shanghai",
    minutes: "-1",
    hours: "-1",
    mdays: "-1",
    months: "-1",
    wdays: "-1",
  },
  auth: {
    enable: false,
    user: "",
    password: "",
  },
  notification: {
    onFailure: false,
    onFailureCount: 1,
    onSuccess: false,
    onDisable: false,
    onSslCertExpiry: false,
    onSslCertExpirySeconds: 604800,
  },
  folderId: 0,
};

const REQUEST_METHODS = [
  { value: RequestMethod.GET, label: "GET" },
  { value: RequestMethod.POST, label: "POST" },
  { value: RequestMethod.PUT, label: "PUT" },
  { value: RequestMethod.DELETE, label: "DELETE" },
  { value: RequestMethod.PATCH, label: "PATCH" },
  { value: RequestMethod.HEAD, label: "HEAD" },
  { value: RequestMethod.OPTIONS, label: "OPTIONS" },
];

const TIMEZONES = [
  "Asia/Shanghai",
  "UTC",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

function parseScheduleArray(value: string): number[] {
  if (value.trim() === "" || value.trim() === "-1") return [-1];
  return value
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !isNaN(v));
}

function formatScheduleArray(arr: number[] | undefined): string {
  if (!arr || arr.length === 0) return "-1";
  if (arr.length === 1 && arr[0] === -1) return "-1";
  return arr.join(", ");
}

function jobToForm(job: CronJob): FormState {
  return {
    title: job.title || "",
    url: job.url,
    enabled: job.enabled,
    saveResponses: job.saveResponses,
    requestMethod: job.requestMethod,
    requestTimeout: job.requestTimeout,
    redirectSuccess: job.redirectSuccess,
    headers: [], // 列表接口不返回 extendedData，编辑时需要单独获取
    body: "",
    schedule: {
      timezone: job.schedule?.timezone || "Asia/Shanghai",
      minutes: formatScheduleArray(job.schedule?.minutes),
      hours: formatScheduleArray(job.schedule?.hours),
      mdays: formatScheduleArray(job.schedule?.mdays),
      months: formatScheduleArray(job.schedule?.months),
      wdays: formatScheduleArray(job.schedule?.wdays),
    },
    auth: {
      enable: false,
      user: "",
      password: "",
    },
    notification: {
      onFailure: false,
      onFailureCount: 1,
      onSuccess: false,
      onDisable: false,
      onSslCertExpiry: false,
      onSslCertExpirySeconds: 604800,
    },
    folderId: job.folderId ?? 0,
  };
}

function formToConfig(form: FormState): CronJobConfig {
  const config: CronJobConfig = {
    title: form.title,
    url: form.url,
    enabled: form.enabled,
    saveResponses: form.saveResponses,
    requestMethod: form.requestMethod as CronJobConfig["requestMethod"],
    requestTimeout: form.requestTimeout,
    redirectSuccess: form.redirectSuccess,
    schedule: {
      timezone: form.schedule.timezone,
      expiresAt: 0,
      minutes: parseScheduleArray(form.schedule.minutes),
      hours: parseScheduleArray(form.schedule.hours),
      mdays: parseScheduleArray(form.schedule.mdays),
      months: parseScheduleArray(form.schedule.months),
      wdays: parseScheduleArray(form.schedule.wdays),
    },
  };

  const headers: Record<string, string> = {};
  for (const h of form.headers) {
    if (h.key.trim()) headers[h.key.trim()] = h.value;
  }
  if (Object.keys(headers).length > 0 || form.body) {
    config.extendedData = { headers, body: form.body };
  }

  // HTTP 基本认证（未启用则不传）
  if (form.auth.enable) {
    config.auth = {
      enable: true,
      user: form.auth.user,
      password: form.auth.password,
    };
  }

  // 通知设置
  config.notification = {
    onFailure: form.notification.onFailure,
    onFailureCount: Math.max(1, form.notification.onFailureCount),
    onSuccess: form.notification.onSuccess,
    onDisable: form.notification.onDisable,
    onSslCertExpiry: form.notification.onSslCertExpiry,
    onSslCertExpirySeconds: form.notification.onSslCertExpirySeconds,
  };

  // 所在文件夹
  config.folderId = form.folderId ?? 0;

  return config;
}

export function ManageCronJobs() {
  const { showToast } = useToast();
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [jobs, setJobs] = useState<CronJob[] | null>(null);
  const [action, setAction] = useState<"start" | "stop" | "run" | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);
  const [folders, setFolders] = useState<CronFolder[] | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderFilter, setFolderFilter] = useState<number | null>(null);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<CronFolder | null>(null);
  const [folderSaving, setFolderSaving] = useState(false);

  // 页面打开不自动请求（免费版 cron-job.org API 每日配额有限），各按钮独立触发对应 API
  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/cron");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("加载状态失败：", e);
      showToast("加载状态失败", "error");
    } finally {
      setLoadingStatus(false);
    }
  };

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

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/admin/cron/folders");
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (e) {
      console.error("加载文件夹失败：", e);
      showToast("加载文件夹失败", "error");
    } finally {
      setLoadingFolders(false);
    }
  };

  // 刷新全部：一次性触发所有 API（明确需要全量刷新时使用）
  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const [statusRes, jobsRes, foldersRes] = await Promise.all([
        fetch("/api/admin/cron"),
        fetch("/api/admin/cron/jobs"),
        fetch("/api/admin/cron/folders"),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }

      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      }
    } catch (e) {
      console.error("刷新失败：", e);
      showToast("刷新失败", "error");
    } finally {
      setRefreshing(false);
    }
  };

  // 执行全局操作（成功后只刷新状态，1 个 API）
  const executeAction = async (type: "start" | "stop" | "run") => {
    setAction(type);
    try {
      const res = await fetch(`/api/admin/cron/${type}`, { method: "POST" });
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

    // 获取详细信息（包含 headers 和 body）
    try {
      const res = await fetch(`/api/admin/cron/jobs/${job.jobId}`);
      if (res.ok) {
        const data = await res.json();
        const detailed = data.job;
        if (detailed?.extendedData?.headers) {
          setForm((prev) => ({
            ...prev,
            headers: Object.entries(detailed.extendedData.headers).map(([key, value]) => ({
              key,
              value: value as string,
            })),
            body: detailed.extendedData?.body || "",
          }));
        }
        if (detailed?.auth) {
          setForm((prev) => ({
            ...prev,
            auth: {
              enable: detailed.auth.enable ?? false,
              user: detailed.auth.user || "",
              password: detailed.auth.password || "",
            },
          }));
        }
        if (detailed?.notification) {
          setForm((prev) => ({
            ...prev,
            notification: {
              onFailure: detailed.notification.onFailure ?? false,
              onFailureCount: detailed.notification.onFailureCount ?? 1,
              onSuccess: detailed.notification.onSuccess ?? false,
              onDisable: detailed.notification.onDisable ?? false,
              onSslCertExpiry: detailed.notification.onSslCertExpiry ?? false,
              onSslCertExpirySeconds: detailed.notification.onSslCertExpirySeconds ?? 604800,
            },
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

  // 删除任务
  const deleteJob = async (jobId: number) => {
    if (!confirm("确定要删除这个定时任务吗？")) return;

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

  // 打开文件夹管理（未加载时先加载）
  const openFolderManager = async () => {
    setShowFolderManager(true);
    if (folders === null && !loadingFolders) {
      await loadFolders();
    }
  };

  // 保存文件夹（创建 / 重命名）
  const saveFolder = async () => {
    if (!folderName.trim()) {
      showToast("文件夹名称不能为空", "error");
      return;
    }
    setFolderSaving(true);
    try {
      const res = editingFolder
        ? await fetch(`/api/admin/cron/folders/${editingFolder.folderId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: folderName.trim() }),
          })
        : await fetch("/api/admin/cron/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: folderName.trim() }),
          });

      if (res.ok) {
        showToast(editingFolder ? "文件夹已重命名" : "文件夹已创建", "success");
        setFolderName("");
        setEditingFolder(null);
        await loadFolders();
      } else {
        const data = await res.json();
        showToast(data.error || "保存文件夹失败", "error");
      }
    } catch (e) {
      console.error("保存文件夹失败：", e);
      showToast("保存文件夹失败，请重试", "error");
    } finally {
      setFolderSaving(false);
    }
  };

  // 删除文件夹（任务移到根目录）
  const deleteFolder = async (folder: CronFolder) => {
    if (!confirm(`确定删除文件夹「${folder.name}」吗？文件夹内的任务将移到根目录。`)) return;
    try {
      const res = await fetch(`/api/admin/cron/folders/${folder.folderId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("文件夹已删除", "success");
        if (folderFilter === folder.folderId) setFolderFilter(null);
        await loadFolders();
        await loadJobs();
      } else {
        const data = await res.json();
        showToast(data.error || "删除文件夹失败", "error");
      }
    } catch (e) {
      console.error("删除文件夹失败：", e);
      showToast("删除文件夹失败，请重试", "error");
    }
  };

  const methodLabel = (method: number) =>
    REQUEST_METHODS.find((m) => m.value === method)?.label || `UNKNOWN(${method})`;

  // 按文件夹筛选任务（folderFilter: null=全部, 0=未分类, >0=具体文件夹）
  const visibleJobs =
    jobs === null
      ? []
      : folderFilter === null
        ? jobs
        : jobs.filter((j) => (j.folderId ?? 0) === folderFilter);

  return (
    <div className="animate-page-enter">
      <header className="mb-6">
        <h1 className="text-xl font-semibold md:text-2xl">定时任务管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理 cron-job.org 定时任务，支持高级配置（参照官方界面）
        </p>
      </header>

      {/* 加载控制条（页面打开不自动请求，免费版 cron-job.org API 每日配额有限） */}
      {(!status || jobs === null) && (
        <div className="mb-8 rounded-xl border border-border bg-card p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">数据尚未加载</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            免费版 cron-job.org API 每日配额有限（100 次），页面打开不会自动请求。按需加载或一键刷新全部。
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={loadStatus}
              disabled={loadingStatus}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingStatus ? "animate-spin" : ""}`} />
              加载状态
            </button>
            <button
              type="button"
              onClick={loadJobs}
              disabled={loadingJobs}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingJobs ? "animate-spin" : ""}`} />
              加载任务列表
            </button>
            <button
              type="button"
              onClick={loadFolders}
              disabled={loadingFolders}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingFolders ? "animate-spin" : ""}`} />
              加载文件夹
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新全部
            </button>
          </div>
        </div>
      )}

      {/* 全局定时发布快速操作 */}
      {status && (
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">全局定时发布</h2>
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              {status.job.enabled ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
              <span>{status.job.enabled ? "运行中" : "未运行"}</span>
            </span>
            {status.job.nextRun && (
              <span className="text-muted-foreground">
                下次执行：{new Date(status.job.nextRun * 1000).toLocaleString("zh-CN")}
              </span>
            )}
            {status.job.jobId && (
              <span className="text-muted-foreground">任务 ID：{status.job.jobId}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => executeAction("start")}
              disabled={action !== null || status.job.enabled || !status.cronJobApiKeyConfigured}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action === "start" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              启动定时发布
            </button>
            <button
              type="button"
              onClick={() => executeAction("stop")}
              disabled={action !== null || !status.job.enabled}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action === "stop" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              停止定时发布
            </button>
            <button
              type="button"
              onClick={() => executeAction("run")}
              disabled={action !== null || !status.cronSecretConfigured}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action === "run" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              手动触发一次
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新全部
            </button>
          </div>
          {!status.cronJobApiKeyConfigured && (
            <p className="mt-3 flex items-start gap-2 text-xs text-yellow-600">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>CRON_JOB_API_KEY 未配置，请在「设置 → 定时任务」中配置后才能管理定时任务。</span>
            </p>
          )}
        </div>
      )}

      {/* 任务区：文件夹侧边栏 + 任务列表 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* 文件夹侧边栏 */}
        <aside className="w-full flex-shrink-0 rounded-xl border border-border bg-card lg:w-52">
          <div className="flex items-center justify-between border-b border-border p-3">
            <h2 className="text-sm font-semibold">文件夹</h2>
            <button
              type="button"
              onClick={openFolderManager}
              title="管理文件夹"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
          <div className="p-2">
            {folders === null ? (
              <button
                type="button"
                onClick={loadFolders}
                disabled={loadingFolders}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loadingFolders ? "animate-spin" : ""}`} />
                {loadingFolders ? "加载中…" : "加载文件夹"}
              </button>
            ) : (
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setFolderFilter(null)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition ${
                    folderFilter === null ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FolderIcon className="h-3.5 w-3.5" />
                    全部任务
                  </span>
                  <span className="text-xs text-muted-foreground">{jobs?.length ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFolderFilter(0)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition ${
                    folderFilter === 0 ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
                  }`}
                >
                  <span>未分类</span>
                  <span className="text-xs text-muted-foreground">
                    {jobs?.filter((j) => (j.folderId ?? 0) === 0).length ?? 0}
                  </span>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.folderId}
                    type="button"
                    onClick={() => setFolderFilter(folder.folderId)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition ${
                      folderFilter === folder.folderId
                        ? "bg-primary/10 font-medium text-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <span className="truncate">{folder.name}</span>
                    <span className="text-xs text-muted-foreground">{folder.jobCount ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* 任务列表 */}
        <div className="flex-1 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold">定时任务列表</h2>
            <button
              type="button"
              onClick={openCreateForm}
              disabled={!status?.cronJobApiKeyConfigured}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              创建任务
            </button>
          </div>

          {jobs === null ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              任务列表尚未加载，点击上方「加载任务列表」或「刷新全部」
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {jobs.length === 0 ? "暂无定时任务，点击「创建任务」开始" : "该文件夹下暂无任务"}
            </div>
          ) : (
          <div className="divide-y divide-border">
            {visibleJobs.map((job, index) => (
              <div
                key={job.jobId}
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                className="p-4 animate-fade-in-up"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${
                          job.enabled ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      <h3 className="truncate font-medium">{job.title || "(无标题)"}</h3>
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                        {methodLabel(job.requestMethod)}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{job.url}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.nextExecution
                          ? `下次：${new Date(job.nextExecution * 1000).toLocaleString("zh-CN")}`
                          : "无预测"}
                      </span>
                      {job.lastExecution > 0 && (
                        <span>上次：{new Date(job.lastExecution * 1000).toLocaleString("zh-CN")}</span>
                      )}
                      <span>ID: {job.jobId}</span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryJob(job)}
                      title="执行历史"
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <HistoryIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleJob(job)}
                      title={job.enabled ? "禁用" : "启用"}
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      {job.enabled ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(job)}
                      title="编辑"
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteJob(job.jobId)}
                      title="删除"
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

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

              <div>
                <label className="mb-1 block text-sm font-medium">所在文件夹</label>
                <select
                  value={form.folderId}
                  onChange={(e) => setForm({ ...form, folderId: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={0}>未分类（根目录）</option>
                  {(folders ?? []).map((folder) => (
                    <option key={folder.folderId} value={folder.folderId}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {folders === null
                    ? "文件夹列表未加载，创建后可在文件夹管理中归类。"
                    : "将任务归入文件夹，便于按文件夹筛选管理。"}
                </p>
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

      {/* 文件夹管理弹窗 */}
      {showFolderManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">文件夹管理</h2>
              <button
                type="button"
                onClick={() => setShowFolderManager(false)}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 新建/重命名表单 */}
            <div className="mb-4 rounded-lg border border-border p-3">
              <label className="mb-1 block text-sm font-medium">
                {editingFolder ? "重命名文件夹" : "新建文件夹"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveFolder()}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="文件夹名称"
                />
                <button
                  type="button"
                  onClick={saveFolder}
                  disabled={folderSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {folderSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingFolder ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                  {editingFolder ? "保存" : "创建"}
                </button>
              </div>
              {editingFolder && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setFolderName("");
                  }}
                  className="mt-2 text-xs text-muted-foreground hover:underline"
                >
                  取消编辑
                </button>
              )}
            </div>

            {/* 文件夹列表 */}
            {folders === null ? (
              <div className="py-8 text-center text-sm text-muted-foreground">加载中…</div>
            ) : folders.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无文件夹，全部任务位于「未分类」
              </div>
            ) : (
              <div className="divide-y divide-border">
                {folders.map((folder) => (
                  <div key={folder.folderId} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {folder.jobCount ?? 0} 个任务
                        {!folder.enabled && "（已禁用）"}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFolder(folder);
                          setFolderName(folder.name);
                        }}
                        title="重命名"
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFolder(folder)}
                        title="删除"
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
