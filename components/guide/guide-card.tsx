"use client";

import { X } from "lucide-react";
import { useOnborda, type CardComponentProps } from "onborda";

/**
 * 引导卡片（onborda 自定义 cardComponent）
 *
 * - 渲染步骤标题与说明文字（来自 guiders.steps 配置）
 * - 底部：跳过 / 下一步（最后一步为「完成」）
 * - 通过自定义事件与 GuideManager 通信（完成/跳过 → 上报进度 + 关闭）
 */
export function GuideCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
}: CardComponentProps) {
  const { currentTour } = useOnborda();
  const isLast = currentStep >= totalSteps - 1;

  const handleClose = () => {
    window.dispatchEvent(
      new CustomEvent("guide:skip", { detail: { guideKey: currentTour } })
    );
  };

  const handleNext = () => {
    if (isLast) {
      window.dispatchEvent(
        new CustomEvent("guide:complete", { detail: { guideKey: currentTour } })
      );
      return;
    }
    nextStep();
  };

  return (
    <div className="w-80 rounded-2xl border border-border bg-card p-5 shadow-xl">
      {/* 头部：进度 + 关闭 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${((currentStep + 1) / Math.max(totalSteps, 1)) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {currentStep + 1}/{totalSteps}
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="关闭引导"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 标题与内容 */}
      <div className="text-base font-semibold text-foreground">{step.title}</div>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {step.content}
      </div>

      {/* 操作 */}
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          跳过
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isLast ? "完成" : "下一步"}
        </button>
      </div>
    </div>
  );
}
