# ADR-0003: 存储抽象多驱动

- Status: **Accepted**（接口与驱动集合已被后续 ADR 修订，见下方说明）
- Date: 2026-09-10

> **现状说明（2026-09-21）**：本 ADR 定的是「存储要抽象成 interface、可换平台」这条原则，仍然成立；
> 但**具体形态已改过两轮**，读本文时请注意：
>
> | 项         | 本文（2026-09-10）                     | 现状                                                          |
> | ---------- | -------------------------------------- | ------------------------------------------------------------- |
> | 接口方法   | `getUploadUrl / delete / getPublicUrl` | `upload / delete / getUrl / download`（服务端直传，无预签名） |
> | 驱动集合   | `VERCEL_BLOB \| S3 \| GITHUB`          | `LOCAL \| GITHUB \| S3 \| WEBDAV`（VERCEL_BLOB 已否决）       |
> | 取驱动方式 | 单实例 `getStorageDriverInstance()`    | `getStorageDriver(channel)`（档案池 + 通道绑定）              |
> | 切换方式   | 改 env                                 | 后台建档案 + 绑通道（env 可覆盖）                             |
>
> 演进路径：0003（多驱动）→ 0008（公私双实例）→ **0015（档案池 + 通道绑定，现行）**。
> 另：`getUrl()` 对私有可见性档案（WebDAV、未配 `publicBase` 的 S3）会抛错，upload 不得内部调用它。
> 图片对外统一走站内路由 `/m/{key}`（见 CONTEXT.md 的 Media Route 词条）。

## Context

图片/视频需 S3 兼容存储，起步零成本、后期可切换平台；GitHub 图床作为免费 fallback；图片访问需 CDN 加速。

## Decision

- `StorageDriver` interface：`getUploadUrl / delete / getPublicUrl`
- `STORAGE_DRIVER = VERCEL_BLOB | S3 | GITHUB` 三驱动
  - VERCEL_BLOB：默认，客户端直传
  - S3：@aws-sdk/client-s3（R2 / OSS / MinIO 等）
  - GITHUB：Contents API 上传 → 返回 **jsDelivr 形态 URL** 存库
- 视频不走 GitHub 驱动（单文件 50MB 限制）
- 图片组件统一懒加载

## Consequences

- 换平台仅改 env，代码零改动
- GitHub 图床需 public repo + fine-grained token 最小权限
- Vercel Blob 非 S3 协议 → 独立 S3 驱动必须实现
