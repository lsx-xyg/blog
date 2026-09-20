import { describe, it, expect } from "vitest";
import type { Guide, GuideStep } from "@/lib/types/guides";
import { buildTourSteps, pickSelector } from "@/lib/guides/shared/tour";

function makeStep(overrides: Partial<GuideStep> = {}): GuideStep {
  return {
    id: "step_1",
    target: "reveal-view",
    title: "设置密码",
    content: "点击这里设置密码",
    placement: "bottom",
    ...overrides,
  } as GuideStep;
}

function makeGuide(steps: GuideStep[]): Guide {
  return {
    id: "g1",
    guideKey: "reveal_password_setup_v1",
    title: "设置密码引导",
    page: "/settings",
    priority: 0,
    status: "published",
    steps,
    targetCondition: { logic: "and", conditions: [] },
  } as unknown as Guide;
}

const hits = (set: Set<string>) => (sel: string) => set.has(sel);

describe("buildTourSteps", () => {
  it("nextRoute 拼接：adminPath + 步骤路由 → /dashboard/settings", () => {
    const steps = buildTourSteps(
      makeGuide([makeStep({ nextRoute: "/settings" })]),
      "dashboard",
      { isHit: hits(new Set()) }
    );
    expect(steps[0].nextRoute).toBe("/dashboard/settings");
  });

  it("无 nextRoute → undefined（下一步在当前页高亮）", () => {
    const steps = buildTourSteps(makeGuide([makeStep()]), "dashboard", {
      isHit: hits(new Set()),
    });
    expect(steps[0].nextRoute).toBeUndefined();
  });

  it("side 取 placement，默认 bottom", () => {
    const bottom = buildTourSteps(makeGuide([makeStep()]), "d", {
      isHit: hits(new Set()),
    });
    const top = buildTourSteps(
      makeGuide([makeStep({ placement: "top" })]),
      "d",
      { isHit: hits(new Set()) }
    );
    expect(bottom[0].side).toBe("bottom");
    expect(top[0].side).toBe("top");
  });

  it("selector 命中检测：命中 data-guide 锚点", () => {
    const guide = makeGuide([makeStep({ target: "reveal-view" })]);
    const steps = buildTourSteps(guide, "d", {
      isHit: hits(new Set(['[data-guide="reveal-view"]'])),
    });
    expect(steps[0].selector).toBe('[data-guide="reveal-view"]');
  });

  it("步骤配置了动态选择器且 DOM 命中 → 用动态选择器", () => {
    const guide = makeGuide([
      makeStep({ target: "", selector: ".btn-primary", selectorMeta: { source: "class", generatedAt: "2026-09-17T00:00:00.000Z" } }),
    ]);
    const steps = buildTourSteps(guide, "d", {
      isHit: hits(new Set([".btn-primary"])),
    });
    expect(steps[0].selector).toBe(".btn-primary");
  });

  it("onMiss：候选选择器存在但 DOM 未命中 → 回调上报", () => {
    const step = makeStep({ target: "reveal-view" });
    const guide = makeGuide([step]);
    let missed: GuideStep | null = null;
    buildTourSteps(guide, "d", {
      isHit: hits(new Set()),
      onMiss: (s) => {
        missed = s;
      },
    });
    expect(missed).toBe(step);
  });

  it("onMiss：DOM 命中 → 不上报", () => {
    const guide = makeGuide([makeStep()]);
    let missed = 0;
    buildTourSteps(guide, "d", {
      isHit: hits(new Set(['[data-guide="reveal-view"]'])),
      onMiss: () => {
        missed++;
      },
    });
    expect(missed).toBe(0);
  });

  it("空步骤 → 空数组", () => {
    const steps = buildTourSteps(makeGuide([]), "d", { isHit: hits(new Set()) });
    expect(steps).toEqual([]);
  });
});

describe("pickSelector", () => {
  it("多个选择器，命中第二个 → 返回第二个", () => {
    expect(pickSelector([".a", ".b", ".c"], hits(new Set([".b"])))).toBe(".b");
  });

  it("全部未命中 → 返回第一个（onborda 兜底显示）", () => {
    expect(pickSelector([".a", ".b"], hits(new Set()))).toBe(".a");
  });

  it("非法选择器（isHit 抛异常）→ 跳过继续尝试", () => {
    const boom = (sel: string) => {
      if (sel === ".bad") throw new Error("invalid selector");
      return sel === ".good";
    };
    expect(pickSelector([".bad", ".good"], boom)).toBe(".good");
  });

  it("空数组 → 空字符串", () => {
    expect(pickSelector([], hits(new Set()))).toBe("");
  });
});
