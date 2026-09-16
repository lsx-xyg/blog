"use client";

/**
 * 定时任务执行历史弹窗
 *
 * - 打开时按需加载历史列表（1 次 API）
 * - 点击单条记录按需加载执行详情（1 次 API，含响应头/体/性能统计）
 * - 字段对齐 cron-job.org 官方 history 结构：
 *   列表项 date/statusText/httpStatus，详情标识符为 identifier（字符串）
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
  Eye,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/components/toast";
import type { CronJobHistoryItem, CronJobExecutionDetail } from "@/lib/types/cron";

/** 官方 statusText → 展示样式 */
function statusMeta(statusText: string): { label: string; tone: "ok" | "warn" | "fail" } {
  const t = (statusText || "").toUpperCase();
  if (t === "OK") return { label: "OK", tone: "ok" };
  if (t === "TIMEOUT" || t === "REQUEST_TOO_LARGE") return { label: t, tone: "warn" };
  return { label: t || "未知状态", tone: "fail" };
}

function StatusBadge({ item }: { item: { statusText: string; httpStatus: number } }) {
  const meta = statusMeta(item.statusText);
  const toneClass =
    meta.tone === "ok"
      ? "bg-green-100 text-green-700"
      : meta.tone === "warn"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {meta.tone === "ok" ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {meta.label}
      {meta.tone === "ok" && item.httpStatus > 0 && (
        <span className="font-mono">{item.httpStatus}</span>
      )}
    </span>
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** 性能统计为微秒，转毫秒展示 */
function formatUs(us: number): string {
  if (!us || us < 0) return "-";
  return formatDuration(us / 1000);
}

function formatTime(unixSeconds: number): string {
  if (!unixSeconds) return "-";
  return new Date(unixSeconds * 1000).toLocaleString("zh-CN");
}

/** 格式化响应体：尝试 JSON 美化，其余原样；超长截断 */
function formatBody(body: string | false | undefined): { text: string; truncated: boolean } {
  if (!body) return { text: "", truncated: false };
  let raw = body;
  try {
    raw = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // 非 JSON，按原样展示
  }
  const MAX = 100_000;
  const truncated = raw.length > MAX;
  return { text: truncated ? raw.slice(0, MAX) : raw, truncated };
}

/** 格式化原始响应头文本（\r\n 分行） */
function formatHeadersText(headers: string | false | undefined): Array<[string, string]> | null {
  if (!headers) return null;
  return headers
    .split(/\r?\n/)
    .filter((l) => l.includes(":"))
    .map((line) => {
      const idx = line.indexOf(":");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    });
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
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [showTimes, setShowTimes] = useState(true);
  const [showResponse, setShowResponse] = useState(false);

  // 打开弹窗时加载历史列表（仅 1 次 API）
  useEffect(() => {
    if (!open) return;
    setHistory(null);
    setDetail(null);
    setActiveLogId(null);
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

  // 点击单条记录 → 加载执行详情（仅 1 次 API，identifier 为字符串）
  const loadDetail = async (item: CronJobHistoryItem) => {
    if (activeLogId === item.jobLogId) {
      setActiveLogId(null);
      setDetail(null);
      return;
    }
    setActiveLogId(item.jobLogId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/cron/jobs/${jobId}/history/${item.identifier}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data.executionDetails || null);
      } else {
        const data = await res.json();
        showToast(data.error || "加载执行详情失败", "error");
        setActiveLogId(null);
      }
    } catch (e) {
      console.error("加载执行详情失败：", e);
      showToast("加载执行详情失败，请重试", "error");
      setActiveLogId(null);
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
                <div key={item.jobLogId} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => loadDetail(item)}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-accent/50"
                  >
                    <StatusBadge item={item} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.date)}
                        </span>
                        <span className="text-muted-foreground">时长：{formatDuration(item.duration)}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.url}</p>
                    </div>
                    {activeLogId === item.jobLogId ? (
                      <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* 展开详情 */}
                  {activeLogId === item.jobLogId && (
                    <div className="border-t border-border p-3">
                      {detailLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : detail ? (
                        <div className="space-y-3 text-sm">
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            <div>
                              <p className="text-xs text-muted-foreground">状态</p>
                              <p className="font-medium">
                                {detail.statusText}
                                {detail.httpStatus > 0 ? `（HTTP ${detail.httpStatus}）` : ""}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">实际执行</p>
                              <p>{formatTime(detail.date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">计划执行</p>
                              <p>{formatTime(detail.datePlanned)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">抖动</p>
                              <p>{formatDuration(detail.jitter)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">执行时长</p>
                              <p>{formatDuration(detail.duration)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">请求 URL</p>
                              <p className="truncate font-mono text-xs" title={detail.url || "-"}>
                                {detail.url || "-"}
                              </p>
                            </div>
                          </div>

                          {/* 性能统计（微秒 → 毫秒） */}
                          {detail.stats && (
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
                                    ["DNS 查询", detail.stats.nameLookup],
                                    ["连接", detail.stats.connect],
                                    ["TLS 握手", detail.stats.appConnect],
                                    ["首字节", detail.stats.startTransfer],
                                    ["总时长", detail.stats.total],
                                  ].map(([label, value]) => (
                                    <div key={String(label)}>
                                      <p className="text-xs text-muted-foreground">{label}</p>
                                      <p className="font-mono text-sm">{formatUs(Number(value))}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 响应查看（有响应数据时） */}
                          {(detail.body || detail.headers) && (
                            <button
                              type="button"
                              onClick={() => setShowResponse(true)}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                            >
                              <Eye className="h-4 w-4" />
                              查看响应
                            </button>
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

      {/* 响应查看弹窗 */}
      {showResponse && detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-lg font-semibold">响应详情</h3>
              <button
                type="button"
                onClick={() => setShowResponse(false)}
                className="rounded-md p-1 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-300/50 bg-yellow-50 p-3 text-xs text-yellow-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  响应内容可能包含敏感信息（如 API Key、Token）。请勿将截图或内容分享给他人。
                </span>
              </div>

              {/* 响应头 */}
              {detail.headers && (
                <div className="mb-4">
                  <h4 className="mb-2 text-sm font-medium">响应头</h4>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
                    {formatHeadersText(detail.headers)?.length ? (
                      <div className="space-y-1">
                        {formatHeadersText(detail.headers)!.map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="flex-shrink-0 font-semibold">{k}:</span>
                            <span className="break-all text-muted-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">无响应头</span>
                    )}
                  </div>
                </div>
              )}

              {/* 响应体 */}
              {detail.body && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">响应体</h4>
                  {formatBody(detail.body).truncated && (
                    <p className="mb-2 text-xs text-yellow-600">
                      响应体过大，仅展示前 100,000 字符
                    </p>
                  )}
                  <pre className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                    {formatBody(detail.body).text || "（空响应体）"}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
