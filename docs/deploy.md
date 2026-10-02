# 部署文档（Vercel + Neon + Cloudflare R2）

本文档覆盖生产环境（Vercel Serverless + Neon PostgreSQL + Cloudflare R2）的存储与媒体部署要点，尤其是**视频相册的 R2 直传**配置。图片默认走 GitHub 仓库档案（`storage.binding.upload/gallery = github`），视频走 R2 档案（`storage.binding.video = r2`）。

## 1. 环境变量（Vercel 项目设置）

| 变量                    | 值（示例）                                                   | 说明                                             |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| `BETTER_AUTH_SECRET`    | 32+ 字节随机串                                               | Better Auth 会话签名                             |
| `DATABASE_URL`          | `postgresql://...-pooler...neon.tech/neondb?sslmode=require` | 池化连接（运行时）                               |
| `DATABASE_URL_UNPOOLED` | `postgresql://...neon.tech/neondb?sslmode=require`           | 非池化（迁移/脚本）                              |
| `STORAGE_DRIVER`        | `LOCAL`                                                      | 旧版公开存储回退值（档案池优先，生产建议不依赖） |
| `ENCRYPTION_KEY`        | 32 字节 base64                                               | 档案敏感字段（token/key）加密                    |
| `NEXT_PUBLIC_SITE_URL`  | `https://blog.dbthree.dpdns.org`                             | sitemap / OG 用                                  |

存储档案与通道绑定**优先存在数据库**（`storage_profiles` + `storage.binding.*`，后台「存储设置」维护），环境变量 `STORAGE_BINDING_*` 仅作应急覆盖。

## 2. Cloudflare R2 配置（视频相册必需）

R2 的 CORS 只能通过 Cloudflare 控制台 / Cloudflare API 配置，**S3 兼容 API 不支持** `put-bucket-cors`。未配置时浏览器直传视频会报「网络异常，上传失败」（OPTIONS 预检被拒：`CORS not configured for this bucket`）。

### 2.1 bucket 与自定义域名

- bucket：`blog`（档案 `r2`，endpoint `https://9346622d9c70dff02482ba508f2fb8d8.us.r2.cloudflarestorage.com`）
- 公开读取：绑定自定义域名 `r2.dbthree.dpdns.org`（bucket 公开读，视频封面/直链走该域名）

### 2.2 CORS 规则（必配）

Cloudflare Dashboard → R2 → `blog` → **Settings → CORS Policy** → 粘贴：

```json
[
  {
    "AllowedOrigins": ["https://blog.dbthree.dpdns.org", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

要点：

- `PUT` 是预签名直传必需；`GET/HEAD` 是公开读取（封面/播放）必需。
- `AllowedHeaders` 必须含 `Content-Type`——前端 PUT 时带了与 presign 一致的 Content-Type，会触发预检。
- 本地开发（`http://localhost:3000`）与生产域名都要放行；如需 Vercel 预览部署，追加 `https://*.vercel.app`。
- 配完可用预检请求验证（见 §5）。

### 2.3 生命周期规则（可选但建议）

未完成的上传（PUT 中断后 S3 上的孤儿文件）由 bucket 生命周期清理：

Cloudflare Dashboard → R2 → `blog` → Settings → Lifecycle Rules → 新建：

- 规则：删除 `multipart` 未完成上传（Incomplete multipart uploads）超过 **7 天**。
- （对象级清理如需更细粒度，可后续加前缀规则。）

## 3. 后台「存储设置」绑定

数据库已有档案（`storage_profiles`：github / github-backup / jianguoyun / r2）与通道绑定：

| 通道                               | 绑定档案     | 说明                          |
| ---------------------------------- | ------------ | ----------------------------- |
| 文章图片 `storage.binding.upload`  | `github`     | 图片走 GitHub 仓库 + 反代 CDN |
| 相册图片 `storage.binding.gallery` | `github`     | 同上                          |
| 视频相册 `storage.binding.video`   | `r2`         | S3 兼容 R2，预签名直传        |
| 备份 `storage.binding.backup`      | `jianguoyun` | WebDAV 坚果云（私有）         |

后台改绑定后调用 `resetStorageDriver()`（后端自动处理），无需重启。

## 4. 视频上传链路与限制

1. 前端选文件 → `probeVideoMeta` 探测时长/宽高 → `POST /api/admin/videos/presign`
2. presign 按视频通道驱动分发：
   - S3/R2 → 返回 `presignedUrl`（有效期按大小：`<50MB → 600s`，`≥50MB → 3600s`，未传 size 默认 3600s）
   - LOCAL → `PRESIGN_UNSUPPORTED` → 前端 multipart 降级
   - GITHUB / WEBDAV → `VIDEO_DRIVER_UNSUPPORTED` → 前端拒绝并提示
3. 前端 `XHR PUT` 直传 R2（Content-Type 取 presign 响应，进度条）→ 成功回调 `POST /api/admin/videos` 落库
4. 失败路径不落库；S3 孤儿文件靠生命周期规则兜底

单文件上限：默认 200MB，后台设置 `video.maxSizeMb` 可调。

## 5. 验证命令

配置 CORS 后验证预检（应返回 200 + `Access-Control-Allow-*`）：

```bash
curl -i -X OPTIONS "https://9346622d9c70dff02482ba508f2fb8d8.us.r2.cloudflarestorage.com/blog/2026/10/test.mp4" \
  -H "Origin: https://blog.dbthree.dpdns.org" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type"
```

- 成功：`HTTP/1.1 200` + `access-control-allow-origin` 头
- 失败：`403 <Code>Unauthorized</Code> CORS not configured for this bucket`（回到 §2.2 重配）

## 6. 常见问题

| 现象                             | 原因                               | 处理                            |
| -------------------------------- | ---------------------------------- | ------------------------------- |
| 视频上传报「网络异常，上传失败」 | R2 bucket 未配 CORS（预检 403）    | §2.2 配 CORS                    |
| 视频已传完但提示「保存记录失败」 | 回调 POST 失败（网络/DB）          | 重试；S3 孤儿文件靠生命周期清理 |
| 图片正常、视频失败               | 图片走 GITHUB、视频走 R2           | 检查 R2 CORS                    |
| 上传到 100% 后卡住               | 服务端还在写文件（multipart 降级） | 等回调完成，「处理中」状态      |
