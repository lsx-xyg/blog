# 个人博客项目规格说明书（SPEC v1.0）

> 状态：**已冻结**（2026-09-10，经多轮设计评审确认）
> 目标读者：开发者本人 + 实施 Agent
> 本文档为唯一权威规格，实施以本文档为准。

---

## 1. 项目概述

- **定位**：个人博客 + 生活相册 + 关于页 + 友链页，全中文内容
- **参考站**：https://czhlove.cn/（刘承 blog）——借鉴其导航结构、文章卡片样式、标签筛选交互、"最新/精选"切换、加载更多
- **架构**：Next.js 全栈（前后端一体，App Router）
- **部署**：Vercel（免费起步，后期流量大再迁自有服务器）
- **域名**：用户自有免费域名，DNS 托管 Cloudflare → 解析到 Vercel

---

## 2. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 15（App Router）+ TypeScript | 用户对 Next.js 零基础，从零搭建 |
| 样式 | Tailwind CSS + CSS 变量三主题 | |
| ORM | Drizzle ORM | schema 即代码，轻量 |
| 数据库 | Neon (PostgreSQL) | 前期免费起步，后期可迁自有服务器 |
| 认证 | Better Auth | 密码 + GitHub OAuth + 账号关联（Auth.js 已并入，官方推荐新项目用 Better Auth） |
| MDX 渲染 | next-mdx-remote-client | 正文存 Markdown 原文，渲染走 MDX 管道 |
| 代码高亮 | Shiki | |
| 后台编辑器 | Milkdown | WYSIWYG Markdown，ProseMirror 内核，活跃维护 |
| 搜索 | minisearch | 纯客户端搜索 |
| 评论 | giscus | GitHub Discussions 驱动，零后端 |
| 定时任务 | cron-job.org + node-cron | 按 DEPLOY_PLATFORM 双实现 |

---

## 3. 仓库结构（双公开仓库）

| 仓库 | 用途 |
|---|---|
| Repo A（公开） | 博客代码 + giscus 评论（Discussions） |
| Repo B（公开） | 纯图床：图片资产，jsDelivr CDN 加速；GitHub token 仅授 Repo B 的 Contents 写权限 |

---

## 4. 数据库设计（Neon PostgreSQL，枚举全大写）

### 4.1 `users`（Better Auth 核心表扩展）
Better Auth 自动创建 `user` / `session` / `account` / `verification` 表。
`user` 表扩展字段：`is_admin boolean DEFAULT false`（管理员标记）。

> **实施记录（T1，2026-09-11）**：`is_admin` 列实现为 **`isAdmin`**（camelCase），与 Better Auth drizzle 适配器列名约定对齐——M4 接入认证时无需字段映射。若未来改用其他 ORM/适配器需注意此命名。

### 4.2 `posts` 文章表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text UNIQUE | URL 别名，手动填，留空用 ID 兜底 |
| `title` | text | |
| `summary` | text | 摘要，列表页展示 |
| `content` | text | Markdown 原文 |
| `cover_url` | text NULL | 封面图，可选 |
| `status` | text CHECK ∈ {DRAFT, SCHEDULED, PUBLISHED} | 三态 |
| `scheduled_at` | timestamptz NULL | 定时发布时间 |
| `featured` | boolean DEFAULT false | 精选 |
| `view_count` | integer DEFAULT 0 | 浏览量 |
| `created_at` / `updated_at` / `published_at` | timestamptz | |

### 4.3 `tags` 全局标签表（文章 + 相册共用一套）
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `name` | text UNIQUE | **原样存储**（大小写敏感，`Nextjs` ≠ `nextjs`） |
| `slug` | text UNIQUE | 由 name 自动生成，冲突加后缀 |
| `created_at` | timestamptz | |

### 4.4 `post_tags` 关联表
`post_id` FK → posts.id（ON DELETE CASCADE）、`tag_id` FK → tags.id（ON DELETE CASCADE），复合主键 (post_id, tag_id)

### 4.5 `gallery_items` 相册表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `title` / `description` | text | 可空 |
| `featured` | boolean DEFAULT false | 精选 |
| `image_url` | text | 存储抽象返回的公开 URL（GitHub 驱动为 jsDelivr 形态） |
| `created_at` | timestamptz | 排序用，倒序展示 |

### 4.6 `gallery_item_tags` 关联表
`gallery_item_id` FK、`tag_id` FK（均 ON DELETE CASCADE），复合主键

### 4.7 `settings` 键值配置表
`key` text PK、`value` jsonb
内置键：`site_title` / `site_description` / `footer_text` / `about_content`（Markdown）/ `admin_path`（后台路径覆盖）/ 社交链接等

### 4.8 `friend_links` 友链表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `url` | text | 对方博客/链接 |
| `avatar_url` | text NULL | 缺省用 favicon 服务 |
| `description` | text DEFAULT '' | |
| `tags` | text[] DEFAULT '{}' | 友链标签，直接存数组，不建关联表 |
| `sort_order` | integer DEFAULT 0 | |
| `created_at` | timestamptz | |

### 4.9 `backup_records` 备份记录表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `file_key` | text | 存储中的备份文件 key |
| `size` | bigint | |
| `triggered_by` | text ∈ {MANUAL, AUTO} | |
| `created_at` | timestamptz | |

---

## 5. 存储抽象（interface，多驱动）

```
interface StorageDriver {
  getUploadUrl(...)  // 上传凭证（预签名 / 客户端直传）
  delete(key)        // 删除
  getPublicUrl(key)  // 公开访问 URL
}
```

- `STORAGE_DRIVER = VERCEL_BLOB | S3 | GITHUB`
  - **VERCEL_BLOB**：默认，客户端直传
  - **S3**：@aws-sdk/client-s3，预签名 URL（R2 / OSS / MinIO 等任意 S3 兼容平台）
  - **GITHUB**：Contents API 上传 → 返回 **jsDelivr 形态 URL** 存库；视频不走 GitHub
- 图片组件统一懒加载（loading="lazy" + decoding="async"）
- 备份上传复用同一 interface（见 §11）

---

## 6. 认证与后台入口

- **Better Auth**：email/password + GitHub OAuth + 账号关联（登录后可在设置中关联 GitHub）
- **引导流程（首次安装）**：
  1. 用户表为空时，`/admin` 开放引导
  2. 引导面板用 GitHub 登录，**第一个登录者直接置为 is_admin**
  3. 可选 `SETUP_SECRET`：设置后引导需输入该密钥（防抢注窗口）
- **引导完成后**：`/admin` 永久返回 404
- **真实后台入口**：`ADMIN_PATH`（env 优先 → 无则查 DB settings 的 `admin_path` 覆盖），动态路由 `/[adminSlug]`，路由不匹配一律 404 伪装（不返回 403/302）
- **前台入口**：登录且 is_admin 时导航栏显示"管理"按钮，跳转后台
- 评论区的 giscus GitHub 登录与后台登录**完全隔离**（iframe 内独立 OAuth App，互不影响）

> **实施记录（T8，2026-09-11）**：
> - 首个管理员产生机制按用户确认方案：**非白名单**。`databaseHooks.user.create.after` 中当用户表 `count <= 1` 时将该用户置 `isAdmin = true`——即第一个创建/登录的用户自动成为管理员（密码注册与 GitHub 登录均触发），引导完成后再创建的用户为普通用户。
> - 后台路径解析 `getAdminPath()`：`ADMIN_PATH` env 优先，去首尾斜杠，无则兜底 `"admin"`；**DB settings 覆盖（T2 时实现，SPEC 已规划）**。当前本地 env 配置 `ADMIN_PATH=dashboard`。
> - 守卫逻辑：`app/[adminSlug]/*` 路由不匹配 → `notFound()`（404 伪装）；匹配但未登录 → 渲染登录页（仅根路径，posts 等子页 404）；登录但非管理员 → `notFound()`。后台 API（`/api/admin/*`）统一 `requireAdmin(req)`，未登录/非管理员返回 404。
> - 前台入口按钮文案"后台"，`components/site-header.tsx` 用 `authClient.useSession()` + `isAdminUser()`（纯函数在 `lib/utils.ts`，client/server 通用——client 组件不可引含服务端 DB 依赖的模块）。
> - GitHub 登录按钮在未配置 `GITHUB_CLIENT_ID/SECRET` 时按预期报错（Better Auth 行为），部署前需配置 OAuth App。
> - e2e 已验证（2026-09-11）：引导页渲染、密码注册 → 首个用户自动管理员、引导完成 `/admin` 404、`/dashboard` 登录页/登录后后台面板/文章管理、未登录 API 404、未匹配路径 404、前台"后台"按钮。

---

## 7. 前台页面

导航菜单：**首页 | 相册 | 关于 | 友链**

| 路由 | 内容 |
|---|---|
| `/` | 首页：文章瀑布流 + 无限滚动 + 顶部标签多选筛选（横排，照参考站样式）+ "最新/精选"切换 + 搜索框 |
| `/posts/[slug]` | 文章页：TOC、Shiki 高亮 + 复制按钮、懒加载图、浏览量、giscus 评论；文章卡片样式照参考站（日期/标题/摘要/标签/封面/"更多阅读"） |
| `/gallery` | 相册：瀑布流 + 无限滚动 + **隐藏式**标签筛选面板（多选）+ 最新/精选切换 |
| `/about` | 关于页：渲染 settings.about_content（Markdown） |
| `/friends` | 友链页：friend_links 卡片展示 |
| `/sitemap.xml` `/robots.txt` `/rss.xml` | SEO 三件套 |

**筛选架构（方案 A，纯客户端）**：
- 首页/相册启动时拉取**全量轻量元数据**（`/api/search-index`：文章标题/摘要/封面/标签/日期/精选 + 相册元数据）
- 前端负责：瀑布流分批渲染、无限滚动、标签多选筛选、最新/精选排序、搜索
- **URL 不变**（与参考站一致，筛选状态为前端 state）
- `SEARCH_MODE=DATABASE` 时切换服务端过滤（开关预留，默认 CLIENT）

> **实施记录（T7，2026-09-11）**：
> - `/api/search-index`：文章已实现（含标签数组，join post_tags+tags）；相册返回结构就位（gallery 表数据为空，T5 闭环后自动有数据）。
> - 首页：SSR 首屏 9 条（SEO 保底）→ `PostWall` 挂载后拉 `/api/search-index` 全量替换数据源；CSS columns 瀑布流（卡片高度自适应错落）+ IntersectionObserver 每次 +9 条；筛选/搜索全前端 state（URL 不变）。
> - 标签多选 = **OR 语义**（命中任一选中标签即显示；2026-09-11 由 AND 调整为 OR，与参考站一致）；"最新/精选"切换；空结果有引导文案。
> - 搜索用 **minisearch**（fields: title/summary/tags，prefix+fuzzy）：默认 tokenizer 不支持中文（整段中文成一个 token 搜不到），已自定义 **CJK 分词**（拉丁按词、中文单字+bigram 索引）——中文关键词可命中。
> - `SEARCH_MODE=DATABASE` 预留：`/api/posts` 已支持 `tags`（逗号分隔，OR 语义）/`featured=1`/`q`（ilike 标题+摘要+标签）服务端过滤，前端接入开关留待启用时。
> - 主题三态（§9 实施）见下。e2e 已验证：标签 AND 筛选、精选、中文搜索、主题切换/记忆/防 FOUC，typecheck+build 通过。

---

## 8. 后台功能（/[adminSlug]）

| 页面 | 功能 |
|---|---|
| 文章管理 | 三态筛选（草稿/定时/发布）、新建/编辑/删除、精选标记 |
| 编辑器 | Milkdown WYSIWYG；标签输入 = **可搜索下拉 combobox**（列出已有标签可搜可选，输入不存在时回车自动创建）；图片拖拽/粘贴上传 |
| 相册管理 | 图片上传/编辑/删除、精选标记、标签 |
| 友链管理 | CRUD |
| 标签管理 | 编辑/删除（删除时自动清除文章/相册上的关联） |
| 备份 | 见 §11 |
| 设置 | site_title / description / footer / about_content / admin_path / 社交链接 |

**标签录入逻辑**：combobox 打开显示已有标签 → 选择或输入新建 → 服务端按 name 精确匹配（大小写敏感）复用已有 tag_id，不存在则新建（name 原样存储 + 生成 slug）。

---

## 9. 主题系统

三色主题（CSS 变量，一套组件）：

| 主题 | 背景 | 前景 |
|---|---|---|
| light（白） | `rgb(255,255,255)` | `rgb(9,9,11)` |
| dark（黑） | `rgb(9,9,11)` | `rgb(250,250,250)` |
| sepia（护眼） | `rgb(250,247,240)` | `rgb(56,51,46)` |

> **2026-09-11 配色全面对齐参考站 czhlove.cn（shadcn 体系）**：不仅背景/前景，surface/card、surface-strong/secondary、border、fg-muted/muted-foreground、selection、accent/primary 全部按参考站三主题变量（light/:root、.theme-warm→sepia、.dark）迁移（HSL→RGB 已换算）。详见 globals.css。

- **默认跟随系统**：首次访问无手动选择时按 `prefers-color-scheme`（浅色→白、深色→黑）
- 导航栏三色切换按钮，手动选择写 `localStorage["theme"]` + 记忆
- 移动端/PC 端响应式

> **实施记录（T7，2026-09-11）**：
> - 实现为 `html.dark` / `html.sepia` class（globals.css tokens 已按此定义），**未用 data-theme**（SPEC 原描述调整——class 与 CSS 变量方案一致、实现更简）。
> - `lib/theme.ts`：`applyTheme(mode)`（system 时按 matchMedia 判断）+ `getStoredTheme()`；layout.tsx `<head>` 内联 `THEME_INIT_SCRIPT` 首屏防 FOUC（渲染前同步应用）。
> - 切换组件 `components/theme-toggle.tsx`：跟随系统/深色/护眼三态胶囊按钮，激活态反色。
> - 已 e2e 验证：三态切换即时生效、刷新后主题保留（localStorage + 防 FOUC 无闪烁）。
> - **滚动条**：全局隐藏（`*{scrollbar-width:none}` + `::-webkit-scrollbar{display:none}`），避免滚动条出现/消失引起布局跳动。

> **T7.1 视觉精修（2026-09-11，commit a9e0b19）**：
> - **shadcn 裸 HSL 变量体系**：globals.css 重构为标准 shadcn 变量（`:root`/`html.dark`/`html.sepia` 三套**裸 HSL 三元组**如 `--background: 46 48% 96%`，body 用 `hsl(var(--background))` 包裹），`@theme inline` 映射 `--color-*: hsl(var(--*))`，保留旧变量名（`--bg`/`--fg`/`--surface` 等）作为兼容别名。**关键坑**：裸 HSL 三元组必须用 `hsl(var())` 包裹，直接 `background: var(--background)` 会被浏览器当成现代 RGB 语法解析成深蓝紫。
> - **字体**：引入 **LXGW WenKai Screen（霞鹜文楷屏显）**，参考站 czhlove.cn 同款。layout.tsx `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css">`，包已做 unicode-range 子集化按需加载。`--font-sans` 优先该字体，fallback 系统字体。**注意**：字体 `@import` 不能放在 `@import "tailwindcss"` 之前，会破坏 Tailwind 编译——必须用 `<link>` 标签。
> - **组件类名迁移**：`bg-accent`→`bg-primary`、`text-accent`→`text-primary`、`focus:border-accent`→`focus:border-ring`、`accent-[--accent]`→`accent-primary`，对齐 shadcn 语义。
> - **瀑布流**：`columns-1 sm:columns-2`（最大 2 列），对齐参考站布局（原 `lg:columns-3` 改为 2 列）。
> - **标签筛选**：AND→OR 语义（`some()` + SQL `exists OR` 组合），参考站行为。
> - 已 e2e 验证：三主题渲染正常、字体加载、2列瀑布流、OR 筛选。

---

## 10. 定时发布

- **固定扫描任务方案**（非每篇动态建任务）：
  - 接口：`GET /api/cron/publish-scheduled`（`CRON_SECRET` 鉴权，幂等）
  - 逻辑：扫描 `scheduled_at <= now AND status='SCHEDULED'` → 置为 PUBLISHED → revalidate
- **双实现（`DEPLOY_PLATFORM=VERCEL | SERVER`）**：
  - `VERCEL`：cron-job.org 一个固定任务（每 5 分钟）触发上述接口
  - `SERVER`：node-cron 直调同一核心逻辑（默认 `ENABLED=false`，服务器上开启）
- `CRON_SECRET`：固定 token（`node:crypto` 生成，`npm run gen:secret` 脚本），存 Vercel env + cron-job.org 请求 header `Authorization: Bearer <token>`
- 注意：cron-job.org 最小间隔 1 分钟、无重试机制 → 接口幂等兜底

---

## 11. 备份与恢复（v1 简化版）

**范围**：全量备份所有业务表（posts / tags / post_tags / gallery_items / gallery_item_tags / settings / friend_links / users / account），**不含 session / verification**。图片本体在存储层，不在备份范围。

- **格式**：JSON 文件（schema 版本号 + 导出时间 + 各表数据数组）
- **导出**：手动 → 生成 JSON 直接**下载到本地**；定时 → 上传到备份存储
- **导入**：上传 JSON → 校验版本 → 事务内按外键顺序恢复（tags → posts → gallery_items → 关联表 → settings → friend_links → users/account）→ **覆盖式**，失败整体回滚；确认弹窗含覆盖警告
- **定时备份**：复用 `StorageDriver`，`BACKUP_DRIVER = VERCEL_BLOB | S3 | GITHUB | LOCAL`，走 `backups/` 前缀；`VERCEL` 模式 cron-job.org 每日触发 `GET /api/cron/backup`，`SERVER` 模式 node-cron 每日；自动备份保留 7 份（`BACKUP_RETENTION`），旧备份自动删除
- **历史**：后台备份页显示 backup_records（时间/大小/来源），可下载、可删除
- ⚠️ **安全提醒**：备份含账号表数据（邮箱等）；`BACKUP_DRIVER=GITHUB` 上传时若 repo 公开，账号信息会公开——部署时自行权衡（私有 repo 或接受）

---

## 12. 环境变量（全大写 + 小写自动转大写兜底）

```ini
# 数据库
DATABASE_URL
# 认证
BETTER_AUTH_SECRET
BETTER_AUTH_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
# 存储
STORAGE_DRIVER=VERCEL_BLOB|S3|GITHUB
BLOB_READ_WRITE_TOKEN
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_PUBLIC_BASE_URL
GITHUB_STORAGE_TOKEN
GITHUB_STORAGE_OWNER
GITHUB_STORAGE_REPO
GITHUB_STORAGE_BRANCH
GITHUB_STORAGE_CDN_BASE   # jsDelivr
# 定时
CRON_SECRET
DEPLOY_PLATFORM=VERCEL|SERVER
# 后台入口
ADMIN_PATH          # 可选，DB settings 可覆盖
SETUP_SECRET        # 可选，引导保护
# 搜索
SEARCH_MODE=CLIENT|DATABASE
# 备份
BACKUP_DRIVER=VERCEL_BLOB|S3|GITHUB|LOCAL
BACKUP_RETENTION=7
# 站点
NEXT_PUBLIC_SITE_URL
```

---

## 13. API 清单

| 路由 | 鉴权 | 用途 |
|---|---|---|
| `/api/auth/*` | Better Auth | 登录（密码/GitHub/账号关联） |
| `/api/search-index` | 公开 | 全量轻量元数据（文章+相册），驱动筛选/搜索/瀑布流 |
| `/api/posts/[slug]/views` | 公开 | 浏览量 +1（客户端上报） |
| `/api/storage/upload-url` | admin | 上传凭证（图片） |
| `/api/admin/posts*` | admin | 文章 CRUD / 发布（含定时） |
| `/api/admin/gallery*` | admin | 相册 CRUD |
| `/api/admin/tags*` | admin | 标签 CRUD |
| `/api/admin/friend-links*` | admin | 友链 CRUD |
| `/api/admin/settings` | admin | 设置读写 |
| `/api/admin/backups/export` | admin | 全量备份下载 |
| `/api/admin/backups/import` | admin | 上传恢复 |
| `/api/admin/backups` | admin | 历史列表 / 删除 |
| `/api/cron/publish-scheduled` | CRON_SECRET | 定时发布扫描 |
| `/api/cron/backup` | CRON_SECRET | 定时全量备份 |
| `/api/rss` | 公开 | RSS/Atom |
| `/sitemap.ts` `/robots.ts` | — | SEO 静态输出 |

---

## 14. 开发里程碑

| 里程碑 | 内容 |
|---|---|
| M1 | 脚手架：Next 15 + TS + Tailwind + Drizzle + Neon 连通 |
| M2 | 数据层：全部 schema + 存储三驱动（Blob/S3/GitHub） |
| M3 | 前台：首页瀑布流、文章页、MDX 渲染、三色主题 |
| M4 | 功能：筛选/搜索/精选/浏览量/评论/SEO/关于/友链 |
| M5 | 后台：引导流程、认证、文章/相册/友链/标签/设置管理、Milkdown 编辑器 |
| M6 | 定时发布 + 备份 + 部署 Vercel + Cloudflare 域名 |

---

## 15. 部署清单（用户需准备）

1. GitHub 双仓库（Repo A 代码 / Repo B 图床）
2. GitHub OAuth App（后台登录用）
3. Neon 项目（创建数据库，取 DATABASE_URL）
4. cron-job.org 账号（两个固定任务：每 5 分钟发布扫描 / 每日备份）
5. Vercel 项目（连接 Repo A，配置全部 env）
6. Cloudflare DNS（免费域名解析到 Vercel）
7. giscus 配置（Repo A 开启 Discussions，后台填入仓库名）

---

## 16. 风险与注意记录

| 项 | 说明 |
|---|---|
| 备份含账号数据 | GitHub 驱动上传公开 repo 会公开账号信息，部署时权衡 |
| cron-job.org 无重试 | 定时接口幂等设计兜底，失败下次扫描自愈 |
| Vercel Hobby 限制 | 自带 Cron 仅每日一次 → 必须用外部 cron-job.org（已定） |
| 引导抢注窗口 | 部署后尽快完成引导，或设置 SETUP_SECRET |
| GitHub 图床 | 单文件 ≤50MB，视频不走 GitHub；jsDelivr 有流量治理政策 |
