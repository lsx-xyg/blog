# ADR 0018：接入 IndexNow 即时索引（issue #31）

- 状态：已接受
- 日期：2026-09-22
- 关联：[issue #31](https://github.com/lsx-xyg/blog/issues/31)、ADR 0017（SEO/GEO 优化）

## 背景

Bing 站长工具显示文章收录有延迟（等爬虫自行发现，小时~天级）。
IndexNow 是 Bing / Yandex / Seznam / Naver / Yep 共用的推送协议：
站点在根目录托管 `{key}.txt` 密钥文件证明所有权，内容变更时 POST URL 列表，
一次提交所有参与引擎共享通知，通常分钟级完成抓取。

**Google 不参与 IndexNow**（2022 年评估后弃用；其 Indexing API 仅限
JobPosting/BroadcastEvent 两类结构化数据页，sitemap ping 端点 2023 年已下线）。
Google 侧的覆盖手段是 sitemap（`/sitemap.xml`，ADR 0017 已就绪）+
Search Console，因此不为 Google 做推送通道。

## 方案

### 密钥管理（DB 动态配置，无环境变量）

- registry 新增 `seo.indexNowEnabled`（开关，默认关）、`seo.indexNowKey`
  （密钥，空 = 首次推送时自动生成 32 位 hex 并持久化）
- 密钥是**公开值**（引擎就是要抓它做校验），不做加密存储、不做敏感字段裁剪

### 密钥文件：middleware 改写，不用 next.config rewrites

协议要求密钥文件在根目录 `https://{host}/{key}.txt`，但密钥在 DB、
部署平台文件系统只读。最初尝试 next.config.ts rewrites，实测 Next 15.5
有两个坑（本地 `next build && next start` 全程实测）：

1. **自定义正则 source 不生效**（`/:keyfile([0-9a-f]+\\.txt)` 静态可达但正则不匹配）
2. **destination 的查询串被丢弃**（rewritten 请求到 API 后 searchParams 为空）

最终方案：`middleware.ts`，matcher `'/([0-9a-f]+\\.txt)'` 粗筛（天然排除
robots.txt / llms.txt 等含非 hex 字符的文件名），middleware 内严格校验
`^[0-9a-f]{8,128}\.txt$` 后内部改写到 `app/api/indexnow/[keyfile]/route.ts`
（**路径参数**传值，不依赖查询串）。不匹配的请求直接放行，零影响。

同时保留直连入口 `/api/indexnow/{key}.txt` 用于排查。
路径密钥与库中不一致一律 404，不泄露密钥有效性。

### 自动推送（旁路，绝不拖垮发布主流程）

`lib/seo/server/indexnow.ts` 的 `notifyPostsChanged` 经 Next 15.1+ 稳定的
`after()` 在响应返回后执行，三处接入：

- `POST /api/admin/posts`（创建即发布）
- `PUT /api/admin/posts/[id]`（更新已发布文章；slug 变更时新旧 URL 都推）
- `GET /api/cron/publish-scheduled`（定时发布到期）

所有失败（未启用/网络/超时/DB）吞掉并落日志，发布接口永不因此报错。
未启用时（默认）完全不发请求。

### 手动触发入口（免官网提交）

`GET/POST /api/admin/seo/indexnow` + 后台设置新增「搜索收录」分区：

- 开关 / 密钥展示与重新生成 / 密钥文件地址链接
- 「立即推送全部 URL」：一键提交首页 + 关于/友链/相册 + 全部已发布文章 + RSS
- 展示 Google 不支持 IndexNow 的说明

## 取舍与已知限制

- **提交 ≠ 收录**：200/202 只表示引擎收到通知，是否抓取/索引由引擎决定
- **防滥用**：引擎对重复提交未变更 URL 的站点降权——自动推送只在
  发布/更新时触发，不做周期性全量推送（全量推送留给手动按钮）
- **`{key}.txt` 与 `app/[adminSlug]`**：middleware before 一切路由，密钥文件
  路径不会落到后台动态段
- 单次请求上限 10000 URL（协议上限），博客体量远达不到，分块逻辑留作保险

## 验证

- 单测：密钥生成/校验、payload 组装、分块、状态码解读（10 例，全量 251 过）
- 本地 `next build && next start` + Postgres 实测：
  `/{key}.txt` 200 返回密钥、错误密钥/非 hex 的 .txt 404、
  robots.txt / llms.txt / 首页 / 文章页 / 随机路径行为不变
- api.indexnow.org 连通性与错误语义实测（403 = 密钥文件校验失败，与映射一致）
