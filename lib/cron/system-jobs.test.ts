import { describe, expect, it } from "vitest";
import {
  SYSTEM_JOB_PRESETS,
  getPresetKeyFromTitle,
  getSystemJobPreset,
  isSystemJob,
  matchSystemJob,
} from "./system-jobs";
import { RequestMethod, type CronJob } from "@/lib/types/cron";

function makeJob(title: string): CronJob {
  return {
    jobId: 1,
    enabled: true,
    title,
    saveResponses: false,
    url: "https://example.com",
    lastStatus: 1,
    lastDuration: 0,
    lastExecution: 0,
    nextExecution: null,
    type: 0,
    requestTimeout: -1,
    redirectSuccess: false,
    folderId: 0,
    requestMethod: RequestMethod.GET,
    schedule: {
      timezone: "Asia/Shanghai",
      expiresAt: 0,
      minutes: [-1],
      hours: [-1],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
  };
}

describe("SYSTEM_JOB_PRESETS", () => {
  it("预设键唯一", () => {
    const keys = SYSTEM_JOB_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("publish_scheduled 预设生成标准配置", () => {
    const preset = getSystemJobPreset("publish_scheduled");
    expect(preset).not.toBeNull();
    const cfg = preset!.createConfig({
      siteUrl: "https://blog.example.com",
      cronSecret: "sec",
    });
    expect(cfg.title).toBe("[系统:publish_scheduled] 定时发布扫描（每分钟）");
    expect(cfg.url).toBe("https://blog.example.com/api/cron/publish-scheduled");
    expect(cfg.extendedData?.headers).toEqual({ "X-Cron-Secret": "sec" });
    expect(cfg.schedule?.minutes).toEqual([-1]);
  });
  it("backup 预设生成标准配置（每天 03:00 + X-Cron-Secret）", () => {
    const preset = getSystemJobPreset("backup");
    expect(preset).not.toBeNull();
    const cfg = preset!.createConfig({
      siteUrl: "https://blog.example.com",
      cronSecret: "sec",
    });
    expect(cfg.title).toBe("[系统:backup] 自动备份（每天 03:00）");
    expect(cfg.url).toBe("https://blog.example.com/api/cron/backup");
    expect(cfg.extendedData?.headers).toEqual({ "X-Cron-Secret": "sec" });
    expect(cfg.schedule?.hours).toEqual([3]);
    expect(cfg.schedule?.minutes).toEqual([0]);
  });
  it("未知 key 返回 null", () => {
    expect(getSystemJobPreset("nope")).toBeNull();
  });
});

describe("getPresetKeyFromTitle（唯一 key 对应）", () => {
  it("从 [系统:key] 标题解析出 key", () => {
    expect(getPresetKeyFromTitle("[系统:backup] 自动备份（每天 03:00）")).toBe("backup");
    expect(getPresetKeyFromTitle("[系统:publish_scheduled] 定时发布扫描（每分钟）")).toBe("publish_scheduled");
  });
  it("旧标题 [系统] 前缀/普通标题解析为 null", () => {
    expect(getPresetKeyFromTitle("[系统] 定时发布扫描（每分钟）")).toBeNull();
    expect(getPresetKeyFromTitle("我的自定义任务")).toBeNull();
  });
});

describe("isSystemJob / matchSystemJob（兼容旧标题）", () => {
  it("新标题 [系统:key] 识别", () => {
    expect(isSystemJob(makeJob("[系统:backup] 自动备份（每天 03:00）"))).toBe(true);
  });
  it("旧标题 [系统] 前缀识别", () => {
    expect(isSystemJob(makeJob("[系统] 定时发布扫描（每分钟）"))).toBe(true);
  });
  it("旧标题「博客定时发布扫描（每分钟）」识别", () => {
    expect(isSystemJob(makeJob("博客定时发布扫描（每分钟）"))).toBe(true);
  });
  it("普通用户任务不识别为系统任务", () => {
    expect(isSystemJob(makeJob("我的自定义任务"))).toBe(false);
  });
  it("matchSystemJob 按 [系统:key] 精确匹配", () => {
    expect(matchSystemJob(makeJob("[系统:backup] 自动备份（每天 03:00）"))?.key).toBe("backup");
    expect(matchSystemJob(makeJob("[系统:publish_scheduled] 定时发布扫描（每分钟）"))?.key).toBe("publish_scheduled");
  });
  it("matchSystemJob 旧标题按名称兜底匹配", () => {
    expect(matchSystemJob(makeJob("博客定时发布扫描（每分钟）"))?.key).toBe("publish_scheduled");
    expect(matchSystemJob(makeJob("[系统] 定时发布扫描（每分钟）"))?.key).toBe("publish_scheduled");
  });
  it("matchSystemJob 无匹配返回 null", () => {
    expect(matchSystemJob(makeJob("我的自定义任务"))).toBeNull();
  });
});
