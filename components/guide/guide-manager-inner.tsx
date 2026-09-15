"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  OnbordaProvider,
  Onborda,
  useOnborda,
  type Step,
} from "onborda";
import { GuideCard } from "./guide-card";
import type { Guide, GuideProgress } from "@/lib/types/guides";
import { GuideProgressStatus } from "@/lib/types/guides";

/** onborda Tour 结构（index.d.ts 未导出，按 types 目录定义） */
interface Tour {
  tour: string;
  steps: Step[];
}

/**
 * 引导管理器（Guide Manager，仅挂载于后台 admin layout）
 *
 * 职责（见 CONTEXT.md）：
 * 1. 加载当前页面的 published 引导配置 + 当前用户进度
 * 2. 监听 guide:trigger 事件（行为触发）→ 匹配引导 → 触发/续接引导
 * 3. 步骤变化时上报进度（in_progress + currentStep）
 * 4. 监听 guide:complete / guide:skip → 上报并关闭
 *
 * 页面只声明 data-guide 锚点并派发触发事件，不直接操作引导逻辑。
 */

const TEMP_ANCHOR = "__guide_trigger__";

function getAdminPath() {
  if (typeof window === "undefined") return "dashboard";
  return window.location.pathname.split("/")[1] || "dashboard";
}

export function GuideManagerInner({ children }: { children: React.ReactNode }) {
  return (
    <OnbordaProvider>
      <GuideEngine>{children}</GuideEngine>
    </OnbordaProvider>
  );
}

function GuideEngine({ children }: { children: React.ReactNode }) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [progressMap, setProgressMap] = useState<
    Record<string, GuideProgress>
  >({});
  const [tourSteps, setTourSteps] = useState<Tour[]>([]);
  const { startOnborda, closeOnborda, setCurrentStep, currentTour, currentStep, isOnbordaVisible } =
    useOnborda();
  const progressRef = useRef(progressMap);
  progressRef.current = progressMap;
  const currentTourRef = useRef(currentTour);
  currentTourRef.current = currentTour;

  /** 上报引导进度 */
  const reportProgress = useCallback(
    (guideKey: string, payload: { status?: GuideProgressStatus; currentStep?: number }) => {
      fetch("/api/admin/guides/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guideKey, ...payload }),
      }).catch(() => {
        /* 静默：上报失败不影响引导体验 */
      });
    },
    []
  );

  /** 清理临时锚点 */
  const cleanupTempAnchors = useCallback(() => {
    document
      .querySelectorAll(`[data-guide="${TEMP_ANCHOR}"]`)
      .forEach((el) => el.removeAttribute("data-guide"));
  }, []);

  // 1. 加载引导配置与用户进度
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [gRes, pRes] = await Promise.all([
          fetch("/api/admin/guides?status=published"),
          fetch("/api/admin/guides/progress"),
        ]);
        if (!cancelled) {
          if (gRes.ok) {
            const d = await gRes.json();
            setGuides(d.guides ?? []);
          }
          if (pRes.ok) {
            const d = await pRes.json();
            setProgressMap(
              Object.fromEntries(
                (d.progress ?? []).map((p: GuideProgress) => [p.guideKey, p])
              )
            );
          }
        }
      } catch {
        /* 静默 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. 监听触发事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const eventName = detail.event as string | undefined;
      const page = (detail.page as string) ?? "";
      const element = detail.element as HTMLElement | null;
      if (!eventName) return;

      // 匹配 published + 事件 + 页面，按优先级排序取第一个
      const guide = guides
        .filter((g) => g.targetCondition?.event === eventName)
        .filter((g) => {
          const gp = g.targetCondition?.page;
          return !gp || page === gp || page.startsWith(gp);
        })
        .sort((a, b) => a.priority - b.priority)[0];
      if (!guide) return;

      // 已完成/已跳过的引导不再触发
      const progress = progressRef.current[guide.guideKey];
      if (
        progress &&
        (progress.status === GuideProgressStatus.COMPLETED ||
          progress.status === GuideProgressStatus.SKIPPED)
      ) {
        return;
      }

      // 构造 onborda tour steps（DB 步骤 → onborda Step）
      const adminPath = getAdminPath();
      const steps: Tour["steps"] = guide.steps.map((s, i) => ({
        icon: null,
        title: s.title,
        content: s.content,
        selector: `[data-guide="${s.target}"]`,
        side: s.placement ?? "bottom",
        showControls: false,
        nextRoute: s.nextRoute ? `/${adminPath}${s.nextRoute}` : undefined,
      }));

      // 第一步指向触发元素（用户点击的按钮），高亮更精准
      if (element instanceof HTMLElement && steps[0]) {
        element.setAttribute("data-guide", TEMP_ANCHOR);
        steps[0].selector = `[data-guide="${TEMP_ANCHOR}"]`;
      }

      setTourSteps([{ tour: guide.guideKey, steps }]);
      startOnborda(guide.guideKey);
      reportProgress(guide.guideKey, { status: GuideProgressStatus.IN_PROGRESS });

      // 续接：in_progress 且保存的步骤元素在当前页面存在 → 直接跳到该步骤
      if (
        progress?.status === GuideProgressStatus.IN_PROGRESS &&
        typeof progress.currentStep === "number" &&
        progress.currentStep > 0
      ) {
        const target = guide.steps[progress.currentStep]?.target;
        setTimeout(() => {
          if (target && document.querySelector(`[data-guide="${target}"]`)) {
            setCurrentStep(progress.currentStep);
          }
        }, 120);
      }
    };
    window.addEventListener("guide:trigger", handler);
    return () => window.removeEventListener("guide:trigger", handler);
  }, [guides, startOnborda, reportProgress, setCurrentStep]);

  // 3. 步骤变化上报进度（进入/切换步骤时）
  useEffect(() => {
    if (currentTour && isOnbordaVisible) {
      reportProgress(currentTour, {
        status: GuideProgressStatus.IN_PROGRESS,
        currentStep,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTour, currentStep, isOnbordaVisible]);

  // 4. 完成 / 跳过
  useEffect(() => {
    const handleComplete = (e: Event) => {
      const guideKey =
        ((e as CustomEvent).detail?.guideKey as string | undefined) ??
        currentTourRef.current;
      if (!guideKey) return;
      reportProgress(guideKey, { status: GuideProgressStatus.COMPLETED });
      setProgressMap((prev) => ({
        ...prev,
        [guideKey]: { ...prev[guideKey], status: GuideProgressStatus.COMPLETED } as GuideProgress,
      }));
      cleanupTempAnchors();
      closeOnborda();
    };
    const handleSkip = (e: Event) => {
      const guideKey =
        ((e as CustomEvent).detail?.guideKey as string | undefined) ??
        currentTourRef.current;
      if (!guideKey) return;
      reportProgress(guideKey, { status: GuideProgressStatus.SKIPPED });
      cleanupTempAnchors();
      closeOnborda();
    };
    window.addEventListener("guide:complete", handleComplete);
    window.addEventListener("guide:skip", handleSkip);
    return () => {
      window.removeEventListener("guide:complete", handleComplete);
      window.removeEventListener("guide:skip", handleSkip);
    };
  }, [reportProgress, closeOnborda, cleanupTempAnchors]);

  // 组件卸载时清理临时锚点
  useEffect(() => cleanupTempAnchors, [cleanupTempAnchors]);

  return (
    <Onborda
      steps={tourSteps}
      cardComponent={GuideCard}
      shadowRgb="0, 0, 0"
      shadowOpacity="0.28"
    >
      {children}
    </Onborda>
  );
}
