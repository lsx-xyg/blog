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
import {
  GuideProgressStatus,
  GUIDE_SKIP_COOLDOWN_DAYS,
  normalizeTargetCondition,
  type GuideStep,
} from "@/lib/types/guides";
import {
  evaluateTargetCondition,
  needsServerData,
} from "@/lib/guides/conditions";

/** onborda Tour 结构（index.d.ts 未导出，按 types 目录定义） */
interface Tour {
  tour: string;
  steps: Step[];
}

/* ---------- 多级定位：data-guide → 动态选择器（拾取生成） ---------- */

/** 步骤候选选择器（按优先级）：data-guide 埋点优先，selector 兜底 */
function resolveStepSelectors(step: GuideStep): string[] {
  const list: string[] = [];
  if (step.target) list.push(`[data-guide="${step.target}"]`);
  if (step.selector) list.push(step.selector);
  return list;
}

/** 取第一个当前 DOM 命中的选择器；都不命中返回第一个（交给 onborda 兜底显示） */
function pickStepSelector(step: GuideStep): string {
  const sels = resolveStepSelectors(step);
  if (sels.length === 0) return "";
  for (const sel of sels) {
    try {
      if (document.querySelector(sel)) return sel;
    } catch {
      /* 非法选择器跳过 */
    }
  }
  return sels[0];
}

/** 依次尝试选择器，返回第一个命中的元素；无命中返回 null */
function queryFirst(selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      /* 非法选择器跳过 */
    }
  }
  return null;
}

/** 等待元素出现（MutationObserver + 超时，不轮询）；超时返回 null */
function waitForElement(
  selectors: string[],
  timeout = 5000,
): Promise<Element | null> {
  const existing = queryFirst(selectors);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = queryFirst(selectors);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
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

  /** skipped 是否已过冷却期（超过 N 天允许重新触发）；completed 永久抑制 */
  const isSkippedExpired = (p: GuideProgress | undefined): boolean => {
    if (!p || p.status !== GuideProgressStatus.SKIPPED || !p.updatedAt) {
      return false;
    }
    const days =
      (Date.now() - new Date(p.updatedAt).getTime()) / 86_400_000;
    return days >= GUIDE_SKIP_COOLDOWN_DAYS;
  };

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
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const eventName = detail.event as string | undefined;
      const target = detail.target as string | undefined;
      const page = (detail.page as string) ?? "";
      const element = detail.element as HTMLElement | null;
      if (!eventName || !target) return;

      // 匹配 published 引导：本地先按 event_click + page 条件粗筛
      const candidates = guides
        .filter((g) => {
          const tc = normalizeTargetCondition(g.targetCondition);
          if (!tc) return false;
          // 本地可判条件（event_click / page）先过一遍；服务端条件不影响粗筛
          const local = tc.conditions.filter(
            (c) => c.field === "event_click" || c.field === "page"
          );
          if (local.length === 0) return false;
          return evaluateTargetCondition(
            { logic: tc.logic, conditions: local },
            { event: eventName, target, page }
          );
        })
        .sort((a, b) => a.priority - b.priority);
      const guide = candidates[0];
      if (!guide) return;

      // 已完成永久抑制；已跳过但未过冷却期 → 不触发；过冷却期 → 允许重新触发
      const progress = progressRef.current[guide.guideKey];
      if (
        progress &&
        (progress.status === GuideProgressStatus.COMPLETED ||
          (progress.status === GuideProgressStatus.SKIPPED &&
            !isSkippedExpired(progress)))
      ) {
        return;
      }

      // 含服务端条件（click_count / user_age_days）→ 调 evaluate API 精筛
      const tc = normalizeTargetCondition(guide.targetCondition);
      if (needsServerData(tc)) {
        try {
          const res = await fetch("/api/admin/guides/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              guideKey: guide.guideKey,
              event: eventName,
              target,
              page,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.matched) return;
        } catch {
          return; // 精筛失败不强行触发
        }
      }

      // 构造 onborda tour steps（DB 步骤 → onborda Step）
      const adminPath = getAdminPath();
      const steps: Tour["steps"] = guide.steps.map((s, i) => ({
        icon: null,
        title: s.title,
        content: s.content,
        selector: pickStepSelector(s),
        side: s.placement ?? "bottom",
        showControls: false,
        nextRoute: s.nextRoute ? `/${adminPath}${s.nextRoute}` : undefined,
      }));

      // 第一步指向触发元素（用户点击的按钮），高亮更精准
      if (element instanceof HTMLElement && steps[0]) {
        element.setAttribute("data-guide", TEMP_ANCHOR);
        steps[0].selector = `[data-guide="${TEMP_ANCHOR}"]`;
      } else if (steps[0] && !queryFirst(resolveStepSelectors(guide.steps[0]))) {
        // 首步元素未渲染（懒加载/弹层）→ 等待出现再开始，避免引导落在空位上
        await waitForElement(resolveStepSelectors(guide.steps[0]));
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
        const step = guide.steps[progress.currentStep];
        setTimeout(() => {
          if (step && queryFirst(resolveStepSelectors(step))) {
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
