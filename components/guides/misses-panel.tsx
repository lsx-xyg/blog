"use client";

/**
 * 引导选择器失效监控面板（#29）
 *
 * 运行时定位失败（pickStepSelector / waitForElement 未命中）已写入 guide_step_events，
 * 本面板从 /api/admin/guides/misses 聚合展示：失效次数、最后失效时间、选择器来源。
 * class/path 来源提示「建议补 data-guide 锚点」（最稳定位）。
 */
import { useCallback, useEffect, useState } from "react";
import { Trash2, ShieldAlert } from "lucide-react";
import { AdminLoadingState } from "@/components/admin/status";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type MissRow = {
  guideKey: string;
  stepId: string;
  selector: string;
  selectorSource: string;
  page: string;
  count: number;
  lastMissAt: string | null;
};

const SOURCE_STYLE: Record<string, string> = {
  id: "bg-green-500/10 text-green-600 dark:text-green-400",
  semantic: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  class: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  path: "bg-red-500/10 text-red-600 dark:text-red-400",
  "data-guide": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  unknown: "bg-muted text-muted-foreground",
};

const SOURCE_LABEL: Record<string, string> = {
  id: "id",
  semantic: "语义属性",
  class: "类名",
  path: "DOM 路径",
  "data-guide": "data-guide",
  unknown: "未知",
};

function sourceAdvice(source: string): string | null {
  if (source === "class" || source === "path") {
    return "选择器依赖 DOM 结构，重构易失效——建议给目标元素补 data-guide 锚点";
  }
  return null;
}

export function GuideMissesPanel() {
  const { showToast } = useToast();
  const [misses, setMisses] = useState<MissRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadMisses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/guides/misses");
      if (!res.ok) return;
      const data = (await res.json()) as { misses: MissRow[] };
      setMisses(data.misses ?? []);
    } catch {
      /* 面板加载失败不阻塞页面 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMisses();
  }, [loadMisses]);

  const clearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/admin/guides/misses", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("clear failed");
      setMisses([]);
      showToast("失效记录已清空", "success");
    } catch {
      showToast("清空失败，请重试", "error");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">失效选择器监控</h3>
          {misses.length > 0 && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              {misses.length} 条待处理
            </span>
          )}
        </div>
        {misses.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">清空记录</span>
          </button>
        )}
      </div>

      {loading ? (
        <AdminLoadingState />
      ) : misses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          暂无失效记录——所有步骤最近一次触发时均成功定位。
        </div>
      ) : (
        <>
          {/* 桌面表格 */}
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">引导</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">步骤</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">失效选择器</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">来源</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">次数</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">最后失效</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {misses.map((m, i) => {
                  const advice = sourceAdvice(m.selectorSource);
                  return (
                    <tr key={`${m.guideKey}-${m.stepId}-${m.selector}-${i}`} className="hover:bg-muted/30">
                      <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs text-foreground">
                        {m.guideKey}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                        {m.stepId}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <div className="truncate font-mono text-xs text-foreground" title={m.selector}>
                          {m.selector}
                        </div>
                        {advice && (
                          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{advice}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                            SOURCE_STYLE[m.selectorSource] ?? SOURCE_STYLE.unknown
                          }`}
                        >
                          {SOURCE_LABEL[m.selectorSource] ?? m.selectorSource}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-foreground">{m.count}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {m.lastMissAt
                          ? new Date(m.lastMissAt).toLocaleString("zh-CN")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片 */}
          <div className="space-y-3 md:hidden">
            {misses.map((m, i) => {
              const advice = sourceAdvice(m.selectorSource);
              return (
                <div key={`${m.guideKey}-${m.stepId}-${m.selector}-${i}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate font-mono text-xs font-medium">{m.guideKey}</span>
                    <span
                      className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        SOURCE_STYLE[m.selectorSource] ?? SOURCE_STYLE.unknown
                      }`}
                    >
                      {SOURCE_LABEL[m.selectorSource] ?? m.selectorSource}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={m.selector}>
                    {m.selector}
                  </div>
                  {advice && (
                    <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">{advice}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>失效 {m.count} 次</span>
                    {m.lastMissAt && <span>{new Date(m.lastMissAt).toLocaleString("zh-CN")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="清空失效记录"
        description="将删除全部选择器失效记录（不会影响引导配置本身）。确定清空吗？"
        confirmLabel="清空"
        loading={clearing}
        onConfirm={() => void clearAll()}
        onClose={() => setConfirmClear(false)}
      />
    </section>
  );
}
