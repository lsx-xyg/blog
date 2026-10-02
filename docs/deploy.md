# 部署文档（Vercel + Neon + Cloudflare R2）

本文档覆盖生产环境（Vercel Serverless + Neon PostgreSQL + Cloudflare R2）的存储与媒体部署，重点是可照着一步步配的 **R2 视频直传**。图片默认走 GitHub 仓库档案（`storage.binding.upload/gallery = github`），视频走 R2 档案（`storage.binding.video = r2`）。

## 1. 环境变量（Vercel 项目设置）

| 变量                    | 值（示例）                                                   | 说明                                              |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | 32+ 字节随机串                                               | Better Auth 会话签名                              |
| `DATABASE_URL`          | `postgresql://...-pooler...neon.tech/neondb?sslmode=require` | 池化连接（运行时）                                |
| `DATABASE_URL_UNPOOLED` | `postgresql://...neon.tech/neondb?sslmode=require`           | 非池化（迁移/脚本）                               |
| `ENCRYPTION_KEY`        | 32 字节 base64                                               | 档案敏感字段（token/key）加密，**设置后不要更改** |
| `NEXT_PUBLIC_SITE_URL`  | `https://blog.dbthree.dpdns.org`                             | sitemap / OG 用（生产必配）                       |

存储档案与通道绑定**优先存数据库**（`storage_profiles` + `storage.binding.*`，后台「存储设置」维护），环境变量 `STORAGE_BINDING_*` 仅作应急覆盖。

## 2. Cloudflare R2 配置（视频相册必需）

视频文件大、Vercel Serverless 请求体有限制，所以视频**不走 API 转发**，而是预签名直传：浏览器直接上传到 R2，成功后才回调落库。**R2 的 CORS 只能通过 Cloudflare 控制台 / Cloudflare API 配置**（S3 兼容 API 不支持 `put-bucket-cors`）；未配置时上传会报「网络异常，上传失败」。

### 2.1 建桶 + 公开读

1. Cloudflare Dashboard → **R2** → 创建存储桶（Create bucket），名称如 `blog`。
2. 公开读取（两种方式任选其一）：
   - **自定义域名（推荐）**：R2 桶 → Settings → **Custom Domains** → 绑定你自己的域名（如 `r2.dbthree.dpdns.org`），并开启 **Public access**。之后文件直链就是 `https://r2.dbthree.dpdns.org/<key>`。
   - r2.dev 域名：Settings → Public access → 允许通过 `https://pub-<hash>.r2.dev` 公开读取（仅测试用，正式建议自定义域名）。
3. 记下 **S3 API** 的 endpoint（R2 桶 → Settings → **S3 API** 区域，形如 `https://<account_id>.r2.cloudflarestorage.com`）、Access Key ID 与 Secret Access Key（在「Manage R2 API Tokens」创建）。

### 2.2 CORS 规则（必配）

Cloudflare Dashboard → R2 → `blog` → **Settings → CORS Policy** → 粘贴（把 `AllowedOrigins` 换成你的站点域名）：

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
- 本地开发（`http://localhost:3000`）与生产域名都要放行；Vercel 预览部署追加 `"https://*.vercel.app"`。
- 配完用 §6 的验证命令确认。

### 2.3 生命周期规则（建议）

未完成上传（PUT 中断后 S3 上的孤儿文件）由 bucket 生命周期清理：

Cloudflare Dashboard → R2 → `blog` → **Settings → Lifecycle Rules** → 新建规则：

- 类型：**Incomplete multipart uploads**（未完成的分片上传）
- 保留 **7 天** 后删除。

对象级孤儿（上传成功但回调失败留下的完整对象）靠上传时已生成的前缀约定清理，可后续按需加前缀规则。

## 3. 后台绑定视频通道（R2 档案）

1. 后台 → **存储设置**（`/{adminSlug}/storage`，即 `/dashboard/storage`）。
2. **存储档案**区 → 新建档案：
   - 名称：`r2`（任意，建议英文）
   - 驱动：**S3 兼容对象存储**
   - endpoint：§2.1 记下的 `https://<account_id>.r2.cloudflarestorage.com`
   - bucket：`blog`
   - region：`auto`
   - Access Key / Secret Key：R2 API Token
   - **publicBase：`https://r2.dbthree.dpdns.org`**（公开通道必填，否则档案不可用于公开通道）
   - 保存（Token / Secret 加密存储，只显示「已配置」）。
3. **通道绑定**区 → 找到 **「视频相册」** → 下拉选择 `r2` 档案 → 保存。
   - 切换绑定只影响**新上传**；历史文件按入库时记录的平台解析，不受影响。

当前生产库绑定参考：`upload/gallery = github`、`video = r2`、`backup = jianguoyun`（WebDAV）。

## 4. 视频上传链路与限制

1. 前端选文件 → `probeVideoMeta` 探测时长/宽高 → `POST /api/admin/videos/presign`
2. presign 按视频通道驱动分发：
   - **S3/R2** → 返回 `presignedUrl`，前端 `XHR PUT` 直传（进度条），成功后回调 `POST /api/admin/videos` 落库
   - **LOCAL** → `PRESIGN_UNSUPPORTED`，前端 multipart 降级（仅本地开发）
   - **GITHUB / WEBDAV** → `VIDEO_DRIVER_UNSUPPORTED`，**前端直接拒绝并提示**——GitHub 仓库不适合大视频（仓库体积/提交量），WebDAV 无公网直链无法播放，视频只支持 S3/R2 档案
3. 失败路径不落库：presign 失败 / 探测失败 / PUT 失败中断 / 回调失败 均不产生 DB 记录；S3 孤儿文件靠生命周期规则兜底

**presign 有效期**（`lib/videos/server/validate.ts` `presignExpiresForSize`）：

| 文件大小          | 预签名有效期    |
| ----------------- | --------------- |
| < 50MB            | 600s（10 分钟） |
| ≥ 50MB            | 3600s（1 小时） |
| 未传 size（默认） | 3600s           |

单文件上限：默认 **200MB**，后台设置 `video.maxSizeMb` 可调。上传后默认 **DRAFT** 状态，前台 `/videos` 只展示 `PUBLISHED + PUBLIC`。

## 5. 部署后验证

```bash
# 1) CORS 预检（应 200 + access-control-allow-*）
curl -i -X OPTIONS "https://<endpoint>/blog/2026/10/test.mp4" \
  -H "Origin: https://blog.dbthree.dpdns.org" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type"

# 2) 公开直链（上传成功后）
curl -I "https://r2.dbthree.dpdns.org/2026/10/<uuid>.mp4"
```

完整流程验收：后台 → 媒体 → **视频** Tab → 上传 → 编辑 → 发布 → 前台 `/videos` 瀑布流 → 点卡片进 `/videos/[id]` 播放页。

## 6. 常见问题排查

| 现象                                                             | 原因                                                                     | 处理                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 上传报「网络异常，上传失败」                                     | R2 bucket 未配 CORS（预检 403）                                          | §2.2 配 CORS，重跑 §5 预检命令                                                                                             |
| 上传报「上传失败（HTTP 403）」（PUT 阶段）                       | 预签名签名不匹配：前端 PUT 的 Content-Type 与 presign 不一致，或时钟偏差 | 前端必须从 presign 响应取 Content-Type（代码已保证）；检查服务器时间与 NTP 同步；确认 bucket 名 / region 与 presign 时一致 |
| 上传报「上传失败（HTTP 400/403）」且日志 `SignatureDoesNotMatch` | Secret Key 配置错误 / 被修改                                             | 后台存储设置里重新填 Secret Key（加密后无法回显，只能重填）                                                                |
| 上传到 100% 卡住（multipart 降级）                               | 服务端还在写文件                                                         | 等回调完成（「处理中」状态），本地开发常见，生产 S3 不受影响                                                               |
| 图片正常、视频失败                                               | 图片走 GITHUB、视频走 R2                                                 | 只查 R2 CORS 与档案配置                                                                                                    |
| 提示「当前存储驱动不适合视频」                                   | 视频通道绑定成了 GITHUB / WEBDAV / LOCAL                                 | 后台存储设置把「视频相册」绑定到 S3/R2 档案                                                                                |
| 视频已传完但提示「保存记录失败」                                 | 回调 POST 失败（网络/DB）                                                | 重试；S3 孤儿文件靠生命周期清理                                                                                            |
| CORS 预检返回 403 `CORS not configured`                          | R2 规则未保存 / AllowedOrigins 不含当前 Origin                           | 检查规则 JSON 与站点域名是否一致，保存后等几秒再试                                                                         |
