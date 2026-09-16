import { beforeEach, describe, expect, it, vi } from "vitest";

// mock 存储层：驱动解析测试不触网不触库
vi.mock("@/lib/storage", () => ({
  getPrivateStorageDriver: vi.fn(),
  getPrivateStorageDriverByType: vi.fn(),
}));

import { getPrivateStorageDriver, getPrivateStorageDriverByType } from "@/lib/storage";
import { resolveBackupStorageDriver } from "./store";

const mockGetCurrent = vi.mocked(getPrivateStorageDriver);
const mockGetByType = vi.mocked(getPrivateStorageDriverByType);

const currentDriver = { name: "local", upload: vi.fn() } as never;
const githubDriver = { name: "github", upload: vi.fn() } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrent.mockResolvedValue(currentDriver);
});

describe("resolveBackupStorageDriver（记录驱动优先，回退当前）", () => {
  it("记录有驱动且配置可用 → 用记录驱动", async () => {
    mockGetByType.mockResolvedValue(githubDriver);
    const driver = await resolveBackupStorageDriver({ storageDriver: "GITHUB" });
    expect(driver).toBe(githubDriver);
    expect(mockGetByType).toHaveBeenCalledWith("GITHUB");
    expect(mockGetCurrent).not.toHaveBeenCalled();
  });

  it("记录有驱动但配置不可用 → 回退当前配置驱动", async () => {
    mockGetByType.mockResolvedValue(null);
    const driver = await resolveBackupStorageDriver({ storageDriver: "S3" });
    expect(driver).toBe(currentDriver);
    expect(mockGetCurrent).toHaveBeenCalledTimes(1);
  });

  it("记录无驱动 → 直接使用当前配置驱动", async () => {
    const driver = await resolveBackupStorageDriver({ storageDriver: null });
    expect(driver).toBe(currentDriver);
    expect(mockGetByType).not.toHaveBeenCalled();
  });
});
