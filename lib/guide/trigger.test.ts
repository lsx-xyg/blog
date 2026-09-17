import { describe, expect, it } from "vitest";
import type { Guide, GuideProgress } from "@/lib/types/guides";
import { GuideProgressStatus } from "@/lib/types/guides";
import {
  decideTrigger,
  evaluateAutoTrigger,
  evaluateEventTrigger,
  isSkippedExpired,
  resolveStepSelectors,
} from "./trigger";

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: "g1",
    guideKey: "test_v1",
    title: "测试引导",
    page: "/cron",
    steps: [
      { id: "s1", target: "cron-save", title: "步骤1", content: "内容1" },
      { id: "s2", target: "", title: "步骤2", content: "内容2", selector: "button.save", selectorMeta: { source: "class", generatedAt: "2026-01-01" } },
    ],
    status: "published",
    targetCondition: null,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Guide;
}

function makeProgress(status: GuideProgressStatus, currentStep = 0): GuideProgress {
  return {
    id: "p1",
    userId: "u1",
    guideKey: "test_v1",
    status,
    currentStep,
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  } as GuideProgress;
}

describe("resolveStepSelectors", () => {
  it("data-guide 埋点优先，selector 兜底", () => {
    expect(resolveStepSelectors(makeGuide().steps[0])).toEqual([
      '[data-guide="cron-save"]',
    ]);
    expect(resolveStepSelectors(makeGuide().steps[1])).toEqual([
      "button.save",
    ]);
  });
});

describe("evaluateEventTrigger（行为触发粗筛）", () => {
  it("event_click + page 用 and 时两者都满足才触发", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "and",
        conditions: [
          { field: "event_click", op: "eq", value: "cron-save" },
          { field: "page", op: "eq", value: "/cron" },
        ],
      },
    });
    expect(
      evaluateEventTrigger(g, { page: "/cron", event: "event_click", target: "cron-save" })
    ).toBe(true);
    expect(
      evaluateEventTrigger(g, { page: "/posts", event: "event_click", target: "cron-save" })
    ).toBe(false);
    expect(
      evaluateEventTrigger(g, { page: "/cron", event: "event_click", target: "other" })
    ).toBe(false);
  });

  it("or 逻辑任一满足即触发", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "or",
        conditions: [
          { field: "event_click", op: "eq", value: "cron-save" },
          { field: "page", op: "eq", value: "/settings" },
        ],
      },
    });
    // 点击匹配，即使页面不匹配
    expect(
      evaluateEventTrigger(g, { page: "/cron", event: "event_click", target: "cron-save" })
    ).toBe(true);
    // 页面匹配也会触发（粗筛阶段）
    expect(
      evaluateEventTrigger(g, { page: "/settings", event: "event_click", target: "none" })
    ).toBe(true);
  });

  it("无本地可判条件（只含 click_count）→ 不粗筛通过", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "and",
        conditions: [{ field: "click_count.cron-save", op: "gte", value: 1 }],
      },
    });
    expect(
      evaluateEventTrigger(g, { page: "/cron", event: "event_click", target: "cron-save" })
    ).toBe(false);
  });
});

describe("evaluateAutoTrigger（页面加载自动触发）", () => {
  it("and 含 event_click → 不自动触发", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "and",
        conditions: [
          { field: "event_click", op: "eq", value: "cron-save" },
          { field: "page", op: "eq", value: "/cron" },
        ],
      },
    });
    expect(evaluateAutoTrigger(g, "/cron")).toBe(false);
  });

  it("or 含 event_click → 去掉 event_click 后剩余条件任一满足即自动触发", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "or",
        conditions: [
          { field: "event_click", op: "eq", value: "cron-save" },
          { field: "page", op: "eq", value: "/cron" },
        ],
      },
    });
    expect(evaluateAutoTrigger(g, "/cron")).toBe(true);
    expect(evaluateAutoTrigger(g, "/posts")).toBe(false);
  });

  it("无 event_click → 按 guide.page 或 page 条件匹配", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "and",
        conditions: [{ field: "page", op: "eq", value: "/settings" }],
      },
    });
    // guide.page = /cron 或 条件 page = /settings 任一命中即触发（原组件语义）
    expect(evaluateAutoTrigger(g, "/settings")).toBe(true);
    expect(evaluateAutoTrigger(g, "/cron")).toBe(true);
    expect(evaluateAutoTrigger(g, "/posts")).toBe(false);
  });

  it("无条件 → 按 guide.page 字段匹配", () => {
    const g = makeGuide({ targetCondition: null });
    expect(evaluateAutoTrigger(g, "/cron")).toBe(true);
    expect(evaluateAutoTrigger(g, "/posts")).toBe(false);
  });
});

describe("decideTrigger（综合决策）", () => {
  it("completed 永久抑制", () => {
    const g = makeGuide({ targetCondition: null });
    const d = decideTrigger(g, {
      page: "/cron",
      progress: makeProgress(GuideProgressStatus.COMPLETED),
    });
    expect(d.shouldTrigger).toBe(false);
  });

  it("skipped 冷却期内抑制、过期后放行", () => {
    const g = makeGuide({ targetCondition: null });
    const fresh = makeProgress(GuideProgressStatus.SKIPPED);
    fresh.updatedAt = new Date(Date.now() - 1_000).toISOString(); // 1 秒前
    expect(decideTrigger(g, { page: "/cron", progress: fresh }).shouldTrigger).toBe(false);

    const old = makeProgress(GuideProgressStatus.SKIPPED);
    old.updatedAt = new Date(Date.now() - 8 * 86_400_000).toISOString(); // 8 天前
    expect(decideTrigger(g, { page: "/cron", progress: old }).shouldTrigger).toBe(true);
  });

  it("事件触发：粗筛通过 + needsServer=false + resumeStep 0", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "and",
        conditions: [
          { field: "event_click", op: "eq", value: "cron-save" },
          { field: "page", op: "eq", value: "/cron" },
        ],
      },
    });
    const d = decideTrigger(g, {
      page: "/cron",
      event: "event_click",
      target: "cron-save",
    });
    expect(d.shouldTrigger).toBe(true);
    expect(d.needsServer).toBe(false);
    expect(d.fromEvent).toBe(true);
    expect(d.resumeStep).toBe(0);
  });

  it("页面加载：续接 in_progress 的 currentStep", () => {
    const g = makeGuide({ targetCondition: null });
    const d = decideTrigger(g, {
      page: "/cron",
      resumeIfInProgress: true,
      progress: makeProgress(GuideProgressStatus.IN_PROGRESS, 1),
    });
    expect(d.shouldTrigger).toBe(true);
    expect(d.resumeStep).toBe(1);
  });

  it("含 click_count → needsServer=true", () => {
    const g = makeGuide({
      targetCondition: {
        logic: "and",
        conditions: [{ field: "click_count.cron-save", op: "gte", value: 1 }],
      },
    });
    const d = decideTrigger(g, { page: "/cron" });
    // guide.page 命中 → 自动触发，但需服务端精筛 click_count
    expect(d.shouldTrigger).toBe(true);
    expect(d.needsServer).toBe(true);
  });
});

describe("isSkippedExpired", () => {
  it("非 skipped 或无记录返回 false", () => {
    expect(isSkippedExpired(undefined)).toBe(false);
    expect(isSkippedExpired(makeProgress(GuideProgressStatus.COMPLETED))).toBe(false);
  });
});
