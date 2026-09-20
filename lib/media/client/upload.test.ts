import { describe, it, expect, vi } from "vitest";
import { validateUploadTarget, uploadMediaFile, uploadMediaFiles } from "@/lib/media/client";
import { MediaType } from "@/lib/types/media";

describe("validateUploadTarget", () => {
  it("仅接受 ARTICLE/GALLERY", () => {
    expect(validateUploadTarget(MediaType.ARTICLE)).toBe(true);
    expect(validateUploadTarget(MediaType.GALLERY)).toBe(true);
    expect(validateUploadTarget("VIDEO")).toBe(false);
    expect(validateUploadTarget(undefined)).toBe(false);
    expect(validateUploadTarget(null)).toBe(false);
  });
});

describe("uploadMediaFile", () => {
  it("成功返回 url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/a.jpg" }),
    }));
    const r = await uploadMediaFile(new File([""], "a.jpg"), MediaType.ARTICLE);
    expect(r).toEqual({ ok: true, url: "https://cdn.example.com/a.jpg" });
    // 断言请求携带 type
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/admin/media");
    expect((init.body as FormData).get("type")).toBe(MediaType.ARTICLE);
    vi.unstubAllGlobals();
  });

  it("失败返回归一化错误（服务端 error 优先）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ error: "文件太大" }),
    }));
    const r = await uploadMediaFile(new File([""], "a.jpg"), MediaType.GALLERY);
    expect(r).toEqual({ ok: false, error: "文件太大" });
    vi.unstubAllGlobals();
  });

  it("网络异常返回兜底错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const r = await uploadMediaFile(new File([""], "a.jpg"), MediaType.ARTICLE);
    expect(r.ok).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("uploadMediaFiles 汇总", () => {
  it("全部成功 → success=N", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "x" }),
    }));
    const r = await uploadMediaFiles([new File([""], "1.jpg"), new File([""], "2.jpg")], MediaType.ARTICLE);
    expect(r).toEqual({ success: 2, failed: 0, firstError: undefined });
    vi.unstubAllGlobals();
  });

  it("部分失败 → failed 计数 + 首个错误", async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "x" }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "炸了" }) });
    vi.stubGlobal("fetch", mock);
    const r = await uploadMediaFiles([new File([""], "1.jpg"), new File([""], "2.jpg")], MediaType.ARTICLE);
    expect(r.success).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.firstError).toBe("炸了");
    vi.unstubAllGlobals();
  });
});
