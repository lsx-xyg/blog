import { describe, expect, it, vi, beforeEach } from "vitest";
import { RequestMethod, type CronJob } from "@/lib/types/cron";

// mock client 适配器：service 测试不触网
vi.mock("@/lib/cron/client", () => ({
  createCronJob: vi.fn(),
  listCronJobs: vi.fn(),
}));

import { createCronJob, listCronJobs } from "@/lib/cron/client";
import {
  createGlobalPublishJob,
  createSystemJob,
  findGlobalPublishJob,
  findSystemJob,
  listSystemJobsStatus,
} from "./service";

const mockCreateCronJob = vi.mocked(createCronJob);
const mockListCronJobs = vi.mocked(listCronJobs);

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    jobId: 1,
    enabled: true,
    title: "[系统] 定时发布扫描（每分钟）",
    saveResponses: false,
    url: "https://example.com/api/cron/publish-scheduled",
    lastStatus: 1,
    lastDuration: 0,
    lastExecution: 0,
    nextExecution: 1700000600,
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSystemJob", () => {
  it("按预设 key 创建，透传 siteUrl/cronSecret", async () => {
    mockCreateCronJob.mockResolvedValue(42);
    const id = await createSystemJob("publish_scheduled", {
      siteUrl: "https://blog.example.com",
      cronSecret: "sec",
    });
    expect(id).toBe(42);
    expect(mockCreateCronJob).toHaveBeenCalledTimes(1);
    const cfg = mockCreateCronJob.mock.calls[0][0];
    expect(cfg.title).toBe("[blog:publish_scheduled] 定时发布扫描（每分钟）");
    expect(cfg.url).toBe("https://blog.example.com/api/cron/publish-scheduled");
    expect(cfg.extendedData?.headers).toEqual({ "X-Cron-Secret": "sec" });
  });

  it("未知预设抛错且不触网", async () => {
    await expect(
      createSystemJob("nope", { siteUrl: "https://x.com", cronSecret: "s" }),
    ).rejects.toThrow("未知的系统定时任务预设: nope");
    expect(mockCreateCronJob).not.toHaveBeenCalled();
  });

  it("createGlobalPublishJob 兼容入口映射到 publish_scheduled", async () => {
    mockCreateCronJob.mockResolvedValue(7);
    await expect(
      createGlobalPublishJob("https://blog.example.com", "sec"),
    ).resolves.toBe(7);
    expect(mockCreateCronJob.mock.calls[0][0].title).toContain("定时发布扫描");
  });
});

describe("findSystemJob", () => {
  it("按预设名匹配任务", async () => {
    mockListCronJobs.mockResolvedValue([
      makeJob({ jobId: 10, title: "博客定时发布扫描（每分钟）" }),
      makeJob({ jobId: 11, title: "普通任务" }),
    ]);
    const job = await findSystemJob("publish_scheduled");
    expect(job?.jobId).toBe(10);
  });

  it("缺省 key 时回退旧标题「定时发布扫描」匹配", async () => {
    mockListCronJobs.mockResolvedValue([makeJob({ jobId: 5, title: "博客定时发布扫描（每分钟）" })]);
    const job = await findSystemJob();
    expect(job?.jobId).toBe(5);
  });

  it("无匹配返回 null", async () => {
    mockListCronJobs.mockResolvedValue([makeJob({ jobId: 1, title: "普通任务" })]);
    await expect(findSystemJob("publish_scheduled")).resolves.toBeNull();
  });

  it("findGlobalPublishJob 兼容入口复用 publish_scheduled 查找", async () => {
    mockListCronJobs.mockResolvedValue([makeJob({ jobId: 9 })]);
    await expect(findGlobalPublishJob()).resolves.toMatchObject({ jobId: 9 });
  });
});

describe("listSystemJobsStatus", () => {
  it("聚合每个预设的状态与 nextRun", async () => {
    mockListCronJobs.mockResolvedValue([
      makeJob({
        jobId: 3,
        enabled: true,
        nextExecution: 1700000700,
        title: "博客定时发布扫描（每分钟）",
      }),
    ]);
    const status = await listSystemJobsStatus();
    // 预设数组新增后（publish_scheduled + backup），按预设顺序返回全部
    expect(status).toHaveLength(2);
    expect(status[0]).toMatchObject({
      key: "publish_scheduled",
      name: "定时发布扫描",
      supportsRun: true,
      enabled: true,
      jobId: 3,
      nextRun: 1700000700,
    });
    expect(status[1]).toMatchObject({
      key: "backup",
      name: "自动备份",
      supportsRun: true,
      enabled: false,
      jobId: undefined,
      nextRun: null,
    });
  });

  it("任务不存在时 enabled=false / jobId 缺省 / nextRun=null", async () => {
    mockListCronJobs.mockResolvedValue([]);
    const status = await listSystemJobsStatus();
    expect(status[0]).toMatchObject({
      enabled: false,
      supportsRun: true,
      nextRun: null,
    });
    expect(status[0].jobId).toBeUndefined();
  });
});
