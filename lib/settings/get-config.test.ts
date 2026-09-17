import { describe, it, expect, vi, beforeEach } from "vitest";

// mock 存储层，模拟 JSONB 反序列化的各种形态
const storeMock = vi.hoisted(() => ({
  getSetting: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@/lib/settings/store", () => storeMock);

import { getConfig } from "@/lib/settings/get-config";

describe("getConfig falsy 合并（评论开关回归）", () => {
  beforeEach(() => {
    storeMock.getSetting.mockReset();
    // 默认 registry 里 giscus.enabled 的 key
    storeMock.getSetting.mockResolvedValue(null);
  });

  it("DB 存 JSONB 布尔 false（生产实测形态）→ 返回 false", async () => {
    storeMock.getSetting.mockResolvedValue(false);
    const v = await getConfig("giscus.enabled");
    expect(v).toBe(false);
  });

  it("DB 存字符串 \"false\"（旧形态）→ 返回 false", async () => {
    storeMock.getSetting.mockResolvedValue("false");
    const v = await getConfig("giscus.enabled");
    expect(v).toBe(false);
  });

  it("DB 存 JSONB 布尔 true → 返回 true", async () => {
    storeMock.getSetting.mockResolvedValue(true);
    const v = await getConfig("giscus.enabled");
    expect(v).toBe(true);
  });

  it("DB 无记录 → 落回默认 true", async () => {
    storeMock.getSetting.mockResolvedValue(null);
    const v = await getConfig("giscus.enabled");
    expect(v).toBe(true);
  });
});
