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
  arrow,
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
    <div className="relative w-[min(90vw,20rem)] overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
      {/* 顶部主色条 */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/30" />

      {/* 头部：序号徽章 + 引导标签 + 关闭 */}
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {currentStep + 1}
          </span>
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            引导提示
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
      <div className="px-4 pt-2.5">
        <div className="text-[15px] font-semibold leading-snug text-foreground">
          {step.title}
        </div>
        <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {step.content}
        </div>
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-between gap-2 px-4 py-3.5">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          跳过
        </button>
        <div className="flex items-center gap-2">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${((currentStep + 1) / Math.max(totalSteps, 1)) * 100}%`,
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {isLast ? "完成" : "下一步"}
          </button>
        </div>
      </div>

      {/* 指向箭头（onborda 按 side 生成的装饰箭头） */}
      {arrow && (
        <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center text-primary/80">
          {arrow}
        </div>
      )}
    </div>
  );
}
