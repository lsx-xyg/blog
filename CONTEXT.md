# Blog Context

个人博客系统的领域模型与通用语言。本文档是项目的术语表，定义所有核心概念的标准名称与含义，确保代码、文档、讨论中使用一致的语言。由 AI 在每次术语决议后即时更新。

## Language

### 内容领域

**Post（文章）**：
博客的核心内容单元，包含标题、摘要、Markdown 内容、封面图、标签、状态、阅读量等属性。是首页瀑布流和文章详情页的主体。
_Avoid_: 博文、日志、article

**Media（媒体资源）**：
统一管理的文件资源（图片为主，预留视频/文件），分为文章图片（ARTICLE）和相册图片（GALLERY）两种类型。记录存储驱动、存储键、URL、尺寸、标签、精选标记等元数据。
_Avoid_: 图片、文件、asset、upload

**Gallery（相册）**：
展示生活图片的独立页面，使用 Media 表中 type=GALLERY 的资源。支持标签筛选、精选切换、瀑布流展示。与文章列表共用标签系统，但内容独立。
_Avoid_: 图片墙、照片集、photo album

**Tag（标签）**：
用于分类和筛选的关键词，文章和相册图片共用同一套标签表。支持大小写敏感去重，名称原样存储。通过 post_tags 和 media_tags 关联表建立多对多关系。
_Avoid_: 分类、category、keyword

**Friend Link（友链）**：
友情链接，展示其他博客/网站的名称、链接、描述、标签。在独立的友链页面展示。
_Avoid_: 链接、外链、link exchange

### 用户与权限领域

**Admin User（管理员用户）**：
拥有后台管理权限的用户，通过 isAdmin 字段标记。第一个管理员通过引导流程（GitHub 登录直接设为管理员）创建。只有管理员可访问后台路径。
_Avoid_: 管理员、admin account

**Admin Path（后台路径）**：
后台管理的入口路径段（如 /dashboard），可通过环境变量或站点设置动态配置。用于隐藏后台入口，防止探测。所有后台路由都在 /[adminSlug] 下。
_Avoid_: 后台地址、admin url、dashboard path

**Better Auth**：
项目使用的认证框架，支持 GitHub OAuth 登录和邮箱密码登录，支持账号关联。替代 NextAuth。
_Avoid_: 认证系统、auth、next-auth

### 存储领域

**Storage Driver（存储驱动）**：
文件存储的抽象接口，定义 upload/delete/getUrl/download 四个方法。支持四种实现：LOCAL（本地文件系统）、GITHUB（GitHub 仓库 + CDN/反代加速）、S3（S3 兼容对象存储，R2/OSS/MinIO 通用）、WEBDAV（坚果云/NAS 等，仅限私有用途）。download 方法用于从存储中读取文件内容，GitHub 驱动重写此方法使用 API+Token 下载私有仓库文件，其他驱动默认实现为 fetch(getUrl())。
_Avoid_: 存储、uploader、file storage

**Storage Profile（存储档案）**：
一份完整的存储配置（storage_profiles 表）：档案名（用平台名，如 github / r2 / webdav）+ 驱动 + 该驱动的配置项（敏感字段 AES-256-GCM 加密入库）。驱动实例按档案构建并缓存，后台可独立增删改、单独测试连通性。
_Avoid_: 存储实例、storage config、存储方案

**Storage Channel（存储通道）**：
存储的用途维度（lib/storage/shared/channels.ts，扩展点文件）：UPLOAD（文章图片）、GALLERY（相册图片）、BACKUP（数据库备份）。每个通道绑定一个档案，上传/备份时按通道路由到对应驱动；`getStorageDriver(channel)` 是唯一入口，禁止按驱动类型直接取实例。
_Avoid_: 用途、通道绑定、storage type

**Public / Private Storage（公开 / 私有存储）**：
档案的可见性属性：public 档案承载公开访问资源（必须有公网 URL），private 档案仅服务端存取。通道按可见性筛选可绑定的档案（如 WebDAV 只能绑 BACKUP）。**注意**：早期"公开/私有存储双通道"模型已被「档案池 + 通道绑定」取代，dashboard 不再有独立的公开/私有两套配置。
_Avoid_: 公开仓库、私有仓库、双通道

**jsDelivr CDN**：
GitHub 存储驱动使用的一种 CDN 加速方式，将 GitHub 仓库中的文件转换为快速访问的 CDN URL。格式：https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}。由档案配置的 cdnBase + urlStyle（path / at）决定实际拼接方式，也支持自建反代前缀。
_Avoid_: CDN、加速

### 配置领域

**Site Settings（站点设置）**：
站点的全局配置集合，存储在数据库 settings 表中，支持后台动态修改。采用分层优先级：环境变量 > 数据库配置 > 默认值。包含站名、简介、社交链接、存储配置、定时任务配置、评论配置等。
_Avoid_: 配置、settings、config

**Config Group（配置组）**：
站点设置的逻辑分组，如 storage、cron、giscus、social 等。通过 getConfigGroup(prefix) 统一获取，自动将点分隔的键转换为嵌套对象。
_Avoid_: 配置分组、settings group

**Sensitive Setting（敏感配置）**：
包含密钥、Token 等敏感信息的配置项，使用 AES-256-GCM 加密后存储在数据库中。后台不回显明文，只显示"已配置"状态。需要 ENCRYPTION_KEY 环境变量。
_Avoid_: 密钥、secret、token

### 发布领域

**Post Status（文章状态）**：
文章的发布生命周期状态，枚举值：DRAFT（草稿）、PUBLISHED（已发布）、SCHEDULED（定时发布）。状态决定文章是否在前台展示。
_Avoid_: 发布状态、status

**Scheduled Post（定时发布）**：
设置了 scheduledAt 未来时间的文章，状态为 SCHEDULED。通过定时任务（cron-job.org 或 node-cron）定期巡查，到期后自动改为 PUBLISHED。
_Avoid_: 定时文章、scheduled article

**Featured（精选）**：
文章或媒体资源的标记字段，标记为精选的内容在首页/相册页的"精选"标签下优先展示。与"最新"切换并列。
_Avoid_: 置顶、推荐、starred

**Slug**：
文章或标签的 URL 友好标识，用于生成干净的 URL（如 /posts/my-first-post）。文章 slug 留空时用 ID 兜底。标签 slug 自动从名称生成。
_Avoid_: 别名、url path、permalink

### 视觉与交互领域

**Theme（主题）**：
站点的视觉配色方案，支持四种模式：light（浅色）、dark（深色）、warm（护眼/米黄）、system（跟随系统）。通过 html 元素的 class（dark / theme-warm）切换，CSS 变量驱动。
_Avoid_: 配色、颜色模式、color scheme

**Onboarding Guide（新手引导）**：
后台的可配置交互引导，帮助管理员完成特定操作流程（如无密码账号设置密码）。配置存储在 guiders 表中（guide_key / page / steps / status / target_condition / priority），运行时由 GuideManager 统一驱动。改版通过更换带版本号的 guide_key 使老用户重新触发。
_Avoid_: 引导、教程、tour、wizard

**Guide Step（引导步骤）**：
引导中的单个步骤，包含 target（Guide Anchor 锚点名）、title、content、placement 等字段。步骤数组以 JSONB 存储在 guiders.steps 中。
_Avoid_: 步骤、step、tooltip

**Guide Anchor（引导锚点）**：
页面上带 data-guide 属性的元素，引导步骤通过 `[data-guide="<target>"]` 选择器定位高亮目标。不依赖 class 和层级结构。锚点值 = 埋点上报 target = 条件配置 value，三者同一标识（注册表 GUIDE_EVENT_ANCHORS 统一维护）。
_Avoid_: 锚点、target element、定位点

**Guide Trigger Condition（引导触发条件）**：
guiders.target_condition 中的条件表达式 `{logic: and/or, conditions: [{field, op, value}]}`，决定引导何时触发。field ∈ event_click（点击锚点）/ page（适用页面）/ click_count.<target>（点击累计次数）/ user_age_days（注册天数），op ∈ eq/gte/lte/exists。
_Avoid_: 触发规则、condition、条件表达式

**User Event（用户行为事件）**：
用户行为埋点记录，存储在 user_events 表中（user_id / event / target / created_at），是 click_count 条件的数据源。event 当前固定为 event_click，target 与 Guide Anchor 锚点名同值。
_Avoid_: 埋点、行为记录、event log

**Guide Key（引导键）**：
引导的唯一标识，带版本号（如 reveal_password_setup_v1）。用户进度按 guide_key 独立追踪，互不干扰；引导改版换新 key，老用户自然重新触发。
_Avoid_: 引导 ID、guide id

**Guide Progress（引导进度）**：
用户对某个引导的完成状态，存储在 user_guide_progress 表中，UNIQUE(user_id, guide_key)。status 枚举：not_started / in_progress / completed / skipped。in_progress 时记录 current_step，下次从该步骤续接。
_Avoid_: 进度、onboarding state

**Guide Manager（引导管理器）**：
前端统一引导引擎（仅挂载于后台 admin layout），负责按页面 + 触发事件查询 published 引导配置、查询用户进度、触发或续接引导、上报步骤进度。页面只声明 data-guide 锚点，不直接操作引导逻辑。
_Avoid_: 引导引擎、guide engine、onborda provider

**Sensitive Setting Reveal（敏感配置查看）**：
通过管理员密码二次验证后临时查看敏感配置明文的功能。无密码账号（纯 GitHub OAuth 创建）点击查看时触发 Onboarding Guide 引导设置密码。明文展示 30 秒倒计时自动隐藏。
_Avoid_: 查看明文、reveal、显示密钥

**Reading Progress（阅读进度）**：
文章详情页顶部的进度条，实时显示当前阅读位置占文章总长度的百分比。只计算文章内容区域，不包含评论区。
_Avoid_: 进度条、scroll progress

**TOC（目录）**：
文章详情页的目录导航，从 Markdown 标题自动提取。PC 端右侧固定展示，移动端底部按钮弹出。点击目录项平滑滚动到对应标题，支持当前位置高亮。
_Avoid_: 目录、table of contents、outline

**Waterfall（瀑布流）**：
首页文章列表和相册页图片列表的布局方式，多列不等高排列，随页面滚动无限加载。PC 端最多 4 列，移动端 1 列。
_Avoid_: 瀑布流布局、masonry、grid

### 运维领域

**Backup（备份）**：
数据库的完整导出，以 JSON 格式存储。支持手动导出下载和定时自动备份。备份文件上传到 Private Storage。支持导入恢复。备份记录中存储 storage_driver 字段，记录备份创建时使用的存储驱动，切换驱动后旧备份仍可操作。
_Avoid_: 数据库备份、dump、export

**Backup Storage Driver（备份存储驱动）**：
backup_records 表中的字段，记录备份创建时使用的存储驱动类型（GITHUB/S3/LOCAL）。下载/删除备份时优先使用此字段对应的驱动实例，不可用时回退到当前配置的私有存储驱动。解决切换驱动后旧备份无法操作的问题。
_Avoid_: 备份平台、backup platform

**Backup Retention（备份保留策略）**：
按「保留天数 / 保留条数」自动清理旧备份的规则（`backup.retention_days` / `backup.retention_count`，`0` 表示不限制）。两项任一超限即删；无论怎么配都至少保留最新一份（安全阀）。纯逻辑在 `lib/backup/shared/retention.ts`（`planPrune` / `normalizeRetention`），执行在 `pruneBackups()`——每次创建备份（手动 / 定时）后自动跑一次，后台另有「立即清理」入口。清理复用 `deleteBackup()`，因此同样写审计日志并删除存储中的文件。
_Avoid_: 清理策略、trim policy、retention rule

**Backup Encryption（备份加密）**：
备份文件内容的 AES-256-GCM 加密，需配置 ENCRYPTION_KEY 环境变量。加密后的文件以 BACKUP_ENC_V1: 魔数开头，下载时自动检测并解密。即使私有仓库被访问，没有密钥也无法读取备份内容。未配置密钥时明文存储并警告。
_Avoid_: 加密备份、encrypted backup

**Backup Audit Log（备份审计日志）**：
备份操作的审计记录，存储在 backup_audit_logs 表中。记录 CREATE/DOWNLOAD/DELETE/RESTORE 四种操作类型，包含操作人、IP 地址、User-Agent、操作时间。用于追踪备份文件的访问和操作历史。
_Avoid_: 审计日志、audit log

**Cron Job（定时任务）**：
定期执行的后台任务，用于定时发布文章和定时备份。支持两种部署模式：VERCEL（通过 cron-job.org 外部 API 触发）和 SERVER（使用 node-cron 本地执行）。通过环境变量或站点设置切换。
_Avoid_: 定时任务、scheduled task、cron

**Deployment Platform（部署平台）**：
项目部署的目标平台，决定定时任务的实现方式。枚举值：VERCEL（Serverless，需外部 cron 触发）、SERVER（自有服务器，可用 node-cron）。
_Avoid_: 部署环境、deploy target

## Rules

- 所有枚举值使用全大写（如 DRAFT、PUBLISHED、LOCAL、GITHUB、ARTICLE、GALLERY）
- 标签名称原样存储，不强制大写
- 数据库表名使用蛇形命名（如 post_tags、media_tags）
- 环境变量使用全大写下划线分隔（如 STORAGE_DRIVER、GITHUB_TOKEN）
- data-guide 锚点名使用 kebab-case（如 editor-save、reveal-view）
- 新增术语时，必须同时记录 _Avoid_ 列表，防止同义词混用
