"use client";

/**
 * 定时任务执行历史弹窗
 *
 * - 打开时按需加载历史列表（1 次 API）
 * - 点击单条记录按需加载执行详情（1 次 API，含性能统计 / HTTP 状态码）
 * - 尊重免费版 cron-job.org API 每日配额：不在弹窗内自动批量请求
 */
import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  History as HistoryIcon,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/toast";
import {
  CronJobExecutionStatus,
  type CronJobHistoryItem,
  type CronJobExecutionDetail,
} from "@/lib/types/cron";

const STATUS_META: Record<number, { label: string; tone: "ok" | "warn" | "fail" }> = {
  [CronJobExecutionStatus.OK]: { label: "OK", tone: "ok" },
  [CronJobExecutionStatus.REQUEST_FAILED]: { label: "请求失败（HTTP 错误）", tone: "fail" },
  [CronJobExecutionStatus.NO_RESPONSE]: { label: "无响应", tone: "fail" },
  [CronJobExecutionStatus.TIMEOUT]: { label: "请求超时", tone: "warn" },
  [CronJobExecutionStatus.SSL_CERT_INVALID]: { label: "SSL 证书无效", tone: "fail" },
  [CronJobExecutionStatus.REQUEST_TOO_LARGE]: { label: "请求体过大", tone: "warn" },
  [CronJobExecutionStatus.INTERNAL_ERROR]: { label: "内部错误", tone: "fail" },
  [CronJobExecutionStatus.FAILING_SINCE]: { label: "持续失败", tone: "fail" },
};

function StatusBadge({ status }: { status: number }) {
  const meta = STATUS_META[status] || { label: `未知(${status})`, tone: "warn" as const };
  const toneClass =
    meta.tone === "ok"
      ? "bg-green-100 text-green-700"
      : meta.tone === "warn"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {meta.tone === "ok" ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {meta.label}
    </span>
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(unixSeconds: number): string {
  if (!unixSeconds) return "-";
  return new Date(unixSeconds * 1000).toLocaleString("zh-CN");
}

type Props = {
  jobId: number;
  jobTitle: string;
  open: boolean;
  onClose: () => void;
};

export function CronJobHistoryDialog({ jobId, jobTitle, open, onClose }: Props) {
  const { showToast } = useToast();
  const [history, setHistory] = useState<CronJobHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CronJobExecutionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showTimes, setShowTimes] = useState(true);

  // 打开弹窗时加载历史列表（仅 1 次 API）
  useEffect(() => {
    if (!open) return;
    setHistory(null);
    setDetail(null);
    setActiveId(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/admin/cron/jobs/${jobId}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        } else {
          const data = await res.json();
          showToast(data.error || "加载执行历史失败", "error");
        }
      } catch (e) {
        console.error("加载执行历史失败：", e);
        showToast("加载执行历史失败，请重试", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, jobId]);

  if (!open) return null;

  // 点击单条记录 → 加载执行详情（仅 1 次 API）
  const loadDetail = async (item: CronJobHistoryItem) => {
    if (activeId === item.id) {
      setActiveId(null);
      setDetail(null);
      return;
    }
    setActiveId(item.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/cron/jobs/${jobId}/history/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data.executionDetails || null);
      } else {
        const data = await res.json();
        showToast(data.error || "加载执行详情失败", "error");
        setActiveId(null);
      }
    } catch (e) {
      console.error("加载执行详情失败：", e);
      showToast("加载执行详情失败，请重试", "error");
      setActiveId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-background shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">执行历史</h2>
              <p className="max-w-md truncate text-xs text-muted-foreground">{jobTitle}（ID: {jobId}）</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history === null || history.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {history === null ? "加载失败" : "暂无执行记录"}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => loadDetail(item)}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-accent/50"
                  >
                    <StatusBadge status={item.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.execution)}
                        </span>
                        <span className="text-muted-foreground">时长：{formatDuration(item.duration)}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.url}</p>
                    </div>
                    {activeId === item.id ? (
                      <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* 展开详情 */}
                  {activeId === item.id && (
                    <div className="border-t border-border p-3">
                      {detailLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : detail ? (
                        <div className="space-y-3 text-sm">
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            <div>
                              <p className="text-xs text-muted-foreground">HTTP 状态码</p>
                              <p className="font-mono font-medium">
                                {detail.httpStatusCode > 0 ? detail.httpStatusCode : "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">实际执行</p>
                              <p>{formatTime(detail.execution)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">计划执行</p>
                              <p>{formatTime(detail.plannedExecution)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">抖动</p>
                              <p>{formatDuration(detail.executionJitter)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">有效 URL</p>
                              <p className="truncate font-mono text-xs" title={detail.effectiveURL || "-"}>
                                {detail.effectiveURL || "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">保存响应</p>
                              <p>{detail.saveResponses ? "是" : "否"}</p>
                            </div>
                          </div>

                          {/* 性能统计 */}
                          {detail.times && (
                            <div className="rounded-lg border border-border p-3">
                              <button
                                type="button"
                                onClick={() => setShowTimes(!showTimes)}
                                className="flex w-full items-center justify-between text-left text-sm font-medium"
                              >
                                <span>性能统计</span>
                                {showTimes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                              {showTimes && (
                                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                                  {[
                                    ["DNS 查询", detail.times.dnsLookup],
                                    ["连接", detail.times.connection],
                                    ["SSL 握手", detail.times.tlsHandshake],
                                    ["首字节", detail.times.firstByte],
                                    ["总时长", detail.times.total],
                                  ].map(([label, value]) => (
                                    <div key={String(label)}>
                                      <p className="text-xs text-muted-foreground">{label}</p>
                                      <p className="font-mono text-sm">{formatDuration(Number(value))}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
