# ADR-0003: 存储抽象多驱动

- Status: **Accepted**
- Date: 2026-09-10

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
