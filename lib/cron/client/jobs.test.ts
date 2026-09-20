import { describe, it, expect } from "vitest";
import type { CronJob } from "@/lib/types/cron";
import {
  classifyJob,
  isOrphanSystemJob,
  systemTagColor,
  methodLabel,
  availableActions,
} from "./jobs";

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    jobId: "job-1",
    title: "我的自建任务",
    url: "https://example.com/api/custom",
    requestMethod: 3,
    enabled: true,
    saveResponses: false,
    nextExecution: 0,
    ...overrides,
  } as CronJob;
}

describe("classifyJob", () => {
  it("标题命中预设 → system + preset 非空", () => {
    const c = classifyJob(
      makeJob({
        title: "[blog:backup] 自动备份（每天 03:00）",
        url: "https://example.com/api/cron/backup",
      })
    );
    expect(c.kind).toBe("system");
    expect(c.urlPreset).not.toBeNull();
    expect(c.preset).not.toBeNull();
    expect(c.orphan).toBe(false);
  });

  it("URL 命中系统接口但标题不规范 → system + preset 为 null（需重新启动修复标题）", () => {
    const c = classifyJob(
      makeJob({
        title: "随便起的名字",
        url: "https://example.com/api/cron/backup",
      })
    );
    expect(c.kind).toBe("system");
    expect(c.urlPreset).not.toBeNull();
    expect(c.preset).toBeNull();
    expect(c.orphan).toBe(false);
  });

  it("标题含 [系统/[blog: 但匹配不到预设 → orphan", () => {
    const c = classifyJob(
      makeJob({
        title: "[系统] 某历史任务",
        url: "https://example.com/api/legacy",
      })
    );
    expect(c.kind).toBe("orphan");
    expect(c.urlPreset).toBeNull();
    expect(c.orphan).toBe(true);
  });

  it("URL 命中系统接口但标题不符 → system（urlPreset 兜底识别，待修复标题）", () => {
    const c = classifyJob(
      makeJob({
        title: "备份",
        url: "https://example.com/api/cron/publish-scheduled",
      })
    );
    expect(c.kind).toBe("system");
    expect(c.urlPreset).not.toBeNull();
    expect(c.preset).toBeNull();
  });

  it("标题带 [系统 且 URL 不匹配任何预设 → orphan", () => {
    const c = classifyJob(
      makeJob({
        title: "[系统] 旧版备份任务",
        url: "https://example.com/api/legacy-path",
      })
    );
    expect(c.kind).toBe("orphan");
    expect(c.orphan).toBe(true);
  });

  it("普通任务 → custom", () => {
    const c = classifyJob(makeJob());
    expect(c.kind).toBe("custom");
    expect(c.urlPreset).toBeNull();
    expect(c.preset).toBeNull();
    expect(c.orphan).toBe(false);
  });
});

describe("isOrphanSystemJob", () => {
  it("标题 [blog: 且不匹配预设 → true", () => {
    expect(
      isOrphanSystemJob(makeJob({ title: "[blog:dead-key] 不存在的预设" }))
    ).toBe(true);
  });

  it("标题命中预设 → false（是正规系统任务，不是孤儿）", () => {
    expect(
      isOrphanSystemJob(
        makeJob({ title: "[blog:backup] 自动备份（每天 03:00）", url: "https://example.com/api/cron/backup" })
      )
    ).toBe(false);
  });

  it("普通任务 → false", () => {
    expect(isOrphanSystemJob(makeJob())).toBe(false);
  });
});

describe("systemTagColor", () => {
  it("同一名称恒定返回同一颜色（渲染稳定，不闪变）", () => {
    const a = systemTagColor("自动备份");
    const b = systemTagColor("自动备份");
    expect(a).toBe(b);
    expect(a).toMatch(/^(bg-\S+ \S+ dark:\S+)$/);
  });
});

describe("availableActions", () => {
  it("系统任务启用中 → stop + run（预设支持）+ 编辑/历史/删除", () => {
    const c = classifyJob(
      makeJob({ title: "[blog:backup] 自动备份", url: "https://example.com/api/cron/backup", enabled: true })
    );
    expect(availableActions(makeJob({ enabled: true }), c)).toEqual([
      "stop",
      "run",
      "edit",
      "history",
      "delete",
    ]);
  });

  it("系统任务已停用 → start（不重复出现 run 之外动作）", () => {
    const c = classifyJob(
      makeJob({ title: "[blog:backup] 自动备份", url: "https://example.com/api/cron/backup", enabled: false })
    );
    expect(availableActions(makeJob({ enabled: false }), c)[0]).toBe("start");
  });

  it("普通任务 → toggle + 编辑/历史/删除", () => {
    const c = classifyJob(makeJob());
    expect(availableActions(makeJob(), c)).toEqual([
      "toggle",
      "edit",
      "history",
      "delete",
    ]);
  });
});

describe("methodLabel", () => {
  it("已知方法返回标签", () => {
    expect(methodLabel(3)).toBeTruthy();
  });

  it("未知方法返回 UNKNOWN 兜底", () => {
    expect(methodLabel(99)).toBe("UNKNOWN(99)");
  });
});
