<div align="center">

<img src="docs/logo.png" alt="blog" width="120" />

# blog

**一个基于 Next.js 15 的个人博客系统：前台内容展示 + 后台全栈管理**

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![CI](https://img.shields.io/github/actions/workflow/status/lsx-xyg/blog/sonarcloud.yml?branch=main)
![Vercel](https://img.shields.io/badge/deploy-Vercel-black)
![License](https://img.shields.io/github/license/lsx-xyg/blog)

[文档](https://github.com/lsx-xyg/blog/tree/main/docs) · [在线体验](https://blog.dbthree.dpdns.org) · [反馈](https://github.com/lsx-xyg/blog/issues)

</div>

## 📋 目录

- [💡 这是什么](#-这是什么)
- [✨ 功能](#-功能)
- [🚀 安装](#-安装)
- [📖 使用](#-使用)
- [⚙️ 配置](#️-配置)
- [🛠️ 开发](#️-开发)
- [📁 项目结构](#-项目结构)
- [🧩 扩展](#-扩展)
- [🤝 贡献](#-贡献)
- [📄 License](#-license)

---

## 💡 这是什么

个人技术博客与生活记录：写文章、传相册、挂友链，前台对外展示，后台全部自管理。

解决三类需求：

- 内容创作：Markdown 写作、定时发布、SEO 自动处理
- 站点运营：媒体、友链、评论、主题、存储均在后台动态配置，不用改代码
- 数据安全：数据库自动备份，AES-256-GCM 加密后上传私有存储

与静态博客（如 Hugo）的区别：全栈单仓库，后台管理、定时任务、引导系统开箱即用。

---

## ✨ 功能

| 功能        | 说明                                                               |
| ----------- | ------------------------------------------------------------------ |
| ✍️ 文章管理 | Markdown 分屏编辑器、标签、封面图、精选标记、定时发布、拖拽排序    |
| 🖼️ 媒体库   | 图片上传（文章 / 相册）、未使用图片清理                            |
| 🎬 视频相册 | 个人生活视频（mp4/webm）上传、瀑布流展示、播放页，生产依赖 S3 直传 |
| 🎯 引导系统 | 后台配置步骤与触发条件，CSS 选择器拾取元素（onborda）              |
| ⏰ 定时任务 | 文章定时发布、自动备份（cron-job.org / node-cron 双实现）          |
| 🔐 加密备份 | AES-256-GCM 加密，上传 LOCAL / GitHub / S3 私有存储                |
| 🧭 SEO      | sitemap / RSS / OG 卡片 / IndexNow 即时索引                        |
| 🎨 多主题   | 浅色 / 深色 / 护眼 / 跟随系统，移动端适配                          |
| 💬 评论     | giscus（GitHub Discussions），后台一键开关                         |

---

## 🚀 安装

> [!NOTE]
> 本仓库是自部署 Web 应用，无"下载即用"安装包，普通使用方式为部署到 Vercel 或自有服务器。

### 从源码安装

要求 Node.js 环境（Next.js 15 需 Node 18.18+）。

```bash
git clone https://github.com/lsx-xyg/blog.git
cd blog
npm install
cp .env.example .env # 按需填写，最低必须项见 ⚙️ 配置
npm run dev          # http://localhost:3000
```

---

## 📖 使用

### 部署到 Vercel

1. 导入仓库，生产分支 `main`
2. 配置环境变量（与 `.env.example` 一致；生产 `NEXT_PUBLIC_SITE_URL` 必须为真实域名）
3. 生产构建自动执行数据库迁移（`build = db:migrate:deploy && next build`）
4. 访问 `{站点}/admin` 进入后台（路径可用 `ADMIN_PATH` 修改）

<!-- 替换为实际截图：docs/screenshot-main.png -->

### 后台管理

- **文章**：写 / 改文章、定时发布、精选与标签
- **媒体**：上传图片（文章 / 相册）、清理未使用；**视频** Tab 上传 / 编辑 / 发布 / 删除
- **引导**：配置引导步骤与触发条件，拾取页面元素
- **定时任务**：文章发布、自动备份
- **站点设置**：站点信息、存储驱动、评论开关

### 视频相册

- **后台**：`/dashboard/media` → **视频** Tab，上传 mp4/webm（默认上限 200MB，后台可调），支持编辑标题 / 描述 / 封面 / 标签、发布 / 下架、删除
- **前台**：`/videos` 瀑布流卡片（移动端 2 列 / 桌面端 3~4 列，按视频原始比例错落），点击进入 `/videos/[id]` 播放页（自动静音播放，点击取消静音）
- **存储**：生产依赖 S3 兼容对象存储（如 Cloudflare R2）预签名直传；GITHUB / WEBDAV 不支持视频，LOCAL 仅本地开发降级
- **配置**：R2 建桶 / CORS / 生命周期 / 通道绑定步骤见 [docs/deploy.md](docs/deploy.md)

### 常用命令

```bash
npm run dev         # 开发服务器
npm run test        # vitest 单元测试
npm run typecheck   # TypeScript 类型检查
npm run build       # 生产构建（自动执行数据库迁移）
npm run db:generate # 生成迁移
npm run db:migrate  # 执行迁移
npm run analyze     # 打包体积分析
```

---

## ⚙️ 配置

> [!IMPORTANT]
> `ENCRYPTION_KEY` 用于加密 GitHub Token / S3 Key 等敏感配置，生产环境必须设置，且设置后不要更改，否则已加密数据无法解密。

核心环境变量（完整清单见 `.env.example`）：

| 变量                                                   | 必需 | 说明                                           |
| ------------------------------------------------------ | ---- | ---------------------------------------------- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED`               | 是   | Neon PostgreSQL 池化连接 / 直连连接            |
| `BETTER_AUTH_SECRET`                                   | 是   | Better Auth 会话密钥                           |
| `ENCRYPTION_KEY`                                       | 是   | AES-256-GCM 加密密钥                           |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`            | 否   | GitHub OAuth 登录                              |
| `STORAGE_DRIVER` / `STORAGE_PRIVATE_DRIVER`            | 否   | 公开 / 私有存储驱动：`LOCAL` / `GITHUB` / `S3` |
| `ADMIN_PATH`                                           | 否   | 后台路径（默认 `admin`）                       |
| `NEXT_PUBLIC_SITE_URL`                                 | 否   | 站点根 URL（SEO，生产必配）                    |
| `NEXT_PUBLIC_GISCUS_*`                                 | 否   | giscus 评论配置                                |
| `CRON_SECRET` / `CRON_JOB_API_KEY` / `DEPLOY_PLATFORM` | 否   | 定时任务（`VERCEL` / `SERVER`）                |

<details>
<summary>配置优先级</summary>

**环境变量 > 数据库 settings 表（后台动态配置）> 代码默认值**。

设置了环境变量的项，后台配置不生效；想使用后台动态配置，则不设置对应环境变量。

</details>

---

## 🛠️ 开发

技术栈：Next.js 15（App Router）+ React 19 + TypeScript · Tailwind CSS v4 + Base UI · Neon (PostgreSQL) + Drizzle ORM · Better Auth · MDX + Shiki · vitest

代码约定：

- 提交：Conventional Commits（husky + commitlint + lint-staged 自动执行）
- 测试：新逻辑补充 `lib/**/*.test.ts` 单测
- CI：push / PR 自动运行 SonarCloud 质量分析与 GitLeaks 密钥泄漏扫描（action 均锁定完整 commit SHA）

---

## 📁 项目结构

```text
app/          路由与页面（App Router，含静态 favicon 图标）
components/   前端组件（admin、editor、media、guides、cron 等）
lib/          业务逻辑（admin / auth / backup / cron / crypto / db /
              env / friend-links / guides / mdx / media / posts / seo /
              settings / shared / storage / tags / theme / types）
db/           Drizzle schema 与迁移
scripts/      运维脚本（迁移、回填、播种）
docs/         SPEC.md、adr/（18 条决策记录）、agents/
public/       静态资源（字体、验证文件等）
.github/      CI 工作流（sonarcloud.yml、gitleaks.yml）
```

---

## 🧩 扩展

- **存储驱动**：在 `lib/storage/server/drivers/` 下新增实现，并在 `factory.ts` 注册
- **引导**：后台配置步骤与触发条件；元素锚点用 `data-guide`，或直接拾取 CSS 选择器，无需改前端
- **定时任务**：在 `lib/cron/` 下实现任务逻辑，后台创建并绑定
- **架构决策**：记入 `docs/adr/`

---

## 🤝 贡献

欢迎通过 [GitHub Issues](https://github.com/lsx-xyg/blog/issues) 反馈问题、提出建议，或直接发起 Pull Request。合并要求：通过 `typecheck`、`test`、`lint` 三项检查。

---

## 📄 License

[MIT](LICENSE) © 2026 林圣轩
