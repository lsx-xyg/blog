import { describe, expect, it } from "vitest";
import { buildGuidePickUrl } from "./guide-pick-url";

describe("buildGuidePickUrl", () => {
  it("page 为空返回 null（不生成跳转首页的链接）", () => {
    expect(buildGuidePickUrl("dashboard", "", { guideId: "g1" })).toBeNull();
    expect(buildGuidePickUrl("dashboard", "  ", { guideId: "g1" })).toBeNull();
  });

  it("正常拼接：adminPath + page + 步骤参数", () => {
    expect(
      buildGuidePickUrl("dashboard", "/cron", { guideId: "g1", stepId: "s1" })
    ).toBe("/dashboard/cron?guide-pick=1&guide_id=g1&step_id=s1");
  });

  it("page 带前导斜杠与否结果一致", () => {
    expect(buildGuidePickUrl("admin", "settings", { guideId: "g1" })).toBe(
      "/admin/settings?guide-pick=1&guide_id=g1"
    );
    expect(buildGuidePickUrl("admin", "/settings", { guideId: "g1" })).toBe(
      "/admin/settings?guide-pick=1&guide_id=g1"
    );
  });

  it("触发条件参数：cond_idx", () => {
    expect(
      buildGuidePickUrl("dashboard", "/settings", {
        guideId: "g1",
        conditionIndex: 2,
      })
    ).toBe("/dashboard/settings?guide-pick=1&guide_id=g1&cond_idx=2");
  });

  it("adminPath 去除首尾斜杠", () => {
    expect(buildGuidePickUrl("/dashboard/", "/cron", { guideId: "g1" })).toBe(
      "/dashboard/cron?guide-pick=1&guide_id=g1"
    );
  });
});
