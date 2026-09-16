import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORM,
  formatScheduleArray,
  formToConfig,
  jobToForm,
  parseScheduleArray,
} from "./form";
import { RequestMethod, type CronJob } from "@/lib/types/cron";

/** 构造最小完整 CronJob 测试对象 */
function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    jobId: 1,
    enabled: true,
    title: "测试任务",
    saveResponses: true,
    url: "https://example.com/hook",
    lastStatus: 1,
    lastDuration: 100,
    lastExecution: 1700000000,
    nextExecution: 1700000600,
    type: 0,
    requestTimeout: -1,
    redirectSuccess: false,
    folderId: 0,
    requestMethod: RequestMethod.GET,
    schedule: {
      timezone: "Asia/Shanghai",
      expiresAt: 0,
      minutes: [30],
      hours: [-1],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
    },
    ...overrides,
  };
}

describe("parseScheduleArray（表单字符串 → 数字数组）", () => {
  it("空串 → [-1]", () => {
    expect(parseScheduleArray("")).toEqual([-1]);
    expect(parseScheduleArray("  ")).toEqual([-1]);
  });
  it("'-1' → [-1]", () => {
    expect(parseScheduleArray("-1")).toEqual([-1]);
  });
  it("逗号分隔解析并 trim", () => {
    expect(parseScheduleArray("1, 2, 30")).toEqual([1, 2, 30]);
  });
  it("过滤非法数字", () => {
    expect(parseScheduleArray("1, abc, 2, ")).toEqual([1, 2]);
  });
});

describe("formatScheduleArray（数字数组 → 表单字符串）", () => {
  it("undefined / 空数组 → '-1'", () => {
    expect(formatScheduleArray(undefined)).toBe("-1");
    expect(formatScheduleArray([])).toBe("-1");
  });
  it("单 [-1] → '-1'", () => {
    expect(formatScheduleArray([-1])).toBe("-1");
  });
  it("正常数组 join", () => {
    expect(formatScheduleArray([1, 2, 30])).toBe("1, 2, 30");
  });
});

describe("往返一致性 formToConfig(jobToForm(job))", () => {
  it("核心字段完整保留", () => {
    const job = makeJob({
      title: "发布扫描",
      url: "https://api.example.com/scan",
      enabled: false,
      saveResponses: true,
      requestMethod: RequestMethod.POST,
      requestTimeout: 30,
      redirectSuccess: true,
      schedule: {
        timezone: "UTC",
        expiresAt: 0,
        minutes: [0, 30],
        hours: [9],
        mdays: [-1],
        months: [-1],
        wdays: [1, 3, 5],
      },
    });
    const config = formToConfig(jobToForm(job));
    expect(config.title).toBe("发布扫描");
    expect(config.url).toBe("https://api.example.com/scan");
    expect(config.enabled).toBe(false);
    expect(config.saveResponses).toBe(true);
    expect(config.requestMethod).toBe(RequestMethod.POST);
    expect(config.requestTimeout).toBe(30);
    expect(config.redirectSuccess).toBe(true);
    expect(config.schedule).toEqual({
      timezone: "UTC",
      expiresAt: 0,
      minutes: [0, 30],
      hours: [9],
      mdays: [-1],
      months: [-1],
      wdays: [1, 3, 5],
    });
  });

  it("job 无 schedule 时回退默认时区 Asia/Shanghai", () => {
    const job = makeJob({ schedule: undefined as unknown as CronJob["schedule"] });
    const form = jobToForm(job);
    expect(form.schedule.timezone).toBe("Asia/Shanghai");
  });

  it("通配调度（全部 -1）往返后仍为全部 -1", () => {
    const job = makeJob({
      schedule: {
        timezone: "Asia/Shanghai",
        expiresAt: 0,
        minutes: [-1],
        hours: [-1],
        mdays: [-1],
        months: [-1],
        wdays: [-1],
      },
    });
    const config = formToConfig(jobToForm(job));
    expect(config.schedule?.minutes).toEqual([-1]);
    expect(config.schedule?.hours).toEqual([-1]);
  });
});

describe("formToConfig 可选段", () => {
  it("headers 空 key 被过滤，空 headers 且无 body 时不带 extendedData", () => {
    const config = formToConfig({
      ...DEFAULT_FORM,
      headers: [
        { key: "  ", value: "x" },
        { key: "Authorization", value: "Bearer t" },
      ],
      body: "",
    });
    expect(config.extendedData).toEqual({ headers: { Authorization: "Bearer t" }, body: "" });
  });

  it("body 非空时即便无 headers 也带 extendedData", () => {
    const config = formToConfig({ ...DEFAULT_FORM, headers: [], body: '{"a":1}' });
    expect(config.extendedData).toEqual({ headers: {}, body: '{"a":1}' });
  });

  it("auth 未启用时不传 auth", () => {
    const config = formToConfig({ ...DEFAULT_FORM, auth: { enable: false, user: "u", password: "p" } });
    expect(config.auth).toBeUndefined();
  });

  it("auth 启用时传 user/password", () => {
    const config = formToConfig({ ...DEFAULT_FORM, auth: { enable: true, user: "u", password: "p" } });
    expect(config.auth).toEqual({ enable: true, user: "u", password: "p" });
  });

  it("notification 完整透传，onFailureCount 下限 1", () => {
    const config = formToConfig({
      ...DEFAULT_FORM,
      notification: {
        onFailure: true,
        onFailureCount: 0,
        onSuccess: true,
        onDisable: false,
        onSslCertExpiry: true,
        onSslCertExpirySeconds: 86400,
      },
    });
    expect(config.notification).toEqual({
      onFailure: true,
      onFailureCount: 1,
      onSuccess: true,
      onDisable: false,
      onSslCertExpiry: true,
      onSslCertExpirySeconds: 86400,
    });
  });
});
