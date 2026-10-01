# blog

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Deploy](https://img.shields.io/badge/deploy-Vercel-black)
![CI](https://img.shields.io/github/actions/workflow/status/lsx-xyg/blog/sonarcloud.yml?branch=main)
![License](https://img.shields.io/badge/license-unlicensed-lightgrey)

一个基于 Next.js 15 的个人博客系统：前台内容展示（文章 / 相册 / 友链 / RSS）+ 后台全栈管理（文章、媒体、引导、定时任务、备份、站点设置）。

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Install

本仓库是一个自部署的 Web 应用，不提供"下载即用"的安装包；普通使用方式是部署到 Vercel 或自有服务器，生产地址：<https://blog.dbthree.dpdns.org>。

### 从源码安装

要求 Node.js 环境（Next.js 15 需 Node 18.18+）。

```bash
git clone https://github.com/lsx-xyg/blog.git
cd blog
npm install
cp .env.example .env # 按需填写，最低必须项见 Configuration
npm run dev          # http://localhost:3000
```

## Usage

### 本地开发

```bash
npm run dev        # 启动开发服务器（http://localhost:3000）
npm run test       # 运行 vitest 单元测试
npm run typecheck  # TypeScript 类型检查
npm run lint       # ESLint 检查
npm run build      # 生产构建（自动执行数据库迁移）
npm run analyze    # 打包体积分析（生成 .next/analyze/）
```

数据库迁移相关命令：

```bash
npm run db:generate     # 根据 schema 生成迁移
npm run db:migrate      # 执行迁移
npm run db:migrate:deploy # 部署时执行迁移（幂等）
```

### 部署到 Vercel

1. 导入仓库，生产分支 `main`
2. 在项目设置中配置环境变量（与 `.env.example` 一致，生产 `NEXT_PUBLIC_SITE_URL` 必须为真实域名）
3. 生产构建自动执行数据库迁移（`build = db:migrate:deploy && next build`）
4. 部署后访问 `{站点}/admin` 进入后台（路径可通过 `ADMIN_PATH` 修改）

### 后台管理

- 文章管理：写 / 改文章（Markdown 分屏编辑器、标签、封面图、精选标记）、定时发布、列表拖拽排序
- 媒体库：图片上传（文章 / 相册）、未使用图片清理
- 引导管理：配置引导步骤与触发条件，支持 CSS 选择器拾取元素（onborda）
- 定时任务：文章定时发布、数据库自动备份（加密后上传私有存储）
- 站点设置：站点信息、存储驱动、定时任务、评论开关，全部支持后台动态配置

## Configuration

完整配置项见 `.env.example`（含逐项注释）。核心环境变量：

| 变量                                        | 必需 | 说明                                                            |
| ------------------------------------------- | ---- | --------------------------------------------------------------- |
| `DATABASE_URL`                              | 是   | Neon PostgreSQL 池化连接（应用运行时）                          |
| `DATABASE_URL_UNPOOLED`                     | 是   | 直连连接（迁移 / 脚本）                                         |
| `BETTER_AUTH_SECRET`                        | 是   | Better Auth 会话密钥（`openssl rand -hex 32` 生成）             |
| `ENCRYPTION_KEY`                            | 是   | AES-256-GCM 加密密钥，加密存储 GitHub Token / S3 Key 等敏感配置 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 否   | GitHub OAuth 登录                                               |
| `STORAGE_DRIVER`                            | 否   | 公开存储驱动：`LOCAL` / `GITHUB` / `S3`                         |
| `STORAGE_PRIVATE_DRIVER`                    | 否   | 私有存储驱动：`LOCAL` / `GITHUB` / `S3`（存备份等敏感数据）     |
| `ADMIN_PATH`                                | 否   | 后台管理路径（默认 `admin`）                                    |
| `NEXT_PUBLIC_SITE_URL`                      | 否   | 站点根 URL（SEO / RSS / sitemap，生产环境必配）                 |
| `NEXT_PUBLIC_GISCUS_REPO` 等                | 否   | giscus 评论系统配置（`giscus.app` 生成）                        |
| `CRON_SECRET`                               | 否   | 定时任务接口鉴权密钥                                            |
| `DEPLOY_PLATFORM`                           | 否   | `VERCEL`（cron-job.org 外部触发）/ `SERVER`（node-cron 内置）   |
| `CRON_JOB_API_KEY`                          | 否   | cron-job.org API Key（`VERCEL` 模式下用于创建定时任务）         |

配置优先级：**环境变量 > 数据库 settings 表（后台动态配置）> 代码默认值**。设置了环境变量的项，后台配置不生效；想使用后台动态配置，则不设置对应环境变量。

## Project Structure

```text
app/            路由与页面（App Router，含动态 favicon / icon）
components/     前端组件（admin、editor、media、guides、cron、settings 等）
lib/            业务逻辑（admin / auth / backup / cron / crypto / db / env /
                friend-links / guides / mdx / media / posts / seo / settings /
                shared / storage / tags / theme / types）
db/             Drizzle schema 与迁移
scripts/        运维脚本（数据库迁移、媒体维度回填、数据播种等）
docs/           文档：SPEC.md（产品规格）、adr/（架构决策记录）、agents/
public/         静态资源（字体、Bing 验证文件等）
.github/        CI 工作流（sonarcloud.yml、gitleaks.yml）
```

## Development

### 技术栈

- 框架：Next.js 15（App Router）+ React 19 + TypeScript 5.7
- 样式：Tailwind CSS v4 + Base UI（shadcn 风格）
- 数据库：Neon (PostgreSQL) + Drizzle ORM
- 认证：Better Auth（GitHub OAuth + 账号密码）
- 内容：MDX（next-mdx-remote-client + Shiki 高亮）、ByteMD 编辑器、minisearch 客户端搜索、giscus 评论
- 定时任务：cron-job.org（Vercel）/ node-cron（自有服务器）双实现
- 测试与质量：vitest（+ @vitest/coverage-v8）、ESLint、Prettier、commitlint

### 扩展方式

- **新增存储驱动**：在 `lib/storage/server/drivers/` 下新增驱动实现，并在 `factory.ts` 注册
- **新增引导**：后台「引导管理」配置步骤与触发条件；元素锚点用 `data-guide` 属性，或直接拾取 CSS 选择器，无需改前端代码
- **新增定时任务**：在 `lib/cron/` 下实现任务逻辑，通过后台「定时任务」创建并绑定
- **新增文档**：架构决策记入 `docs/adr/`（已有 0018 条决策记录）

### 代码约定

- 提交规范：Conventional Commits（husky + commitlint + lint-staged 自动执行）
- 测试：新逻辑补充 `lib/**/*.test.ts` 单测
- CI：push / PR 自动运行 SonarCloud 代码质量分析与 GitLeaks 密钥泄漏扫描（工作流内 action 均锁定完整 commit SHA）

## Contributing

欢迎通过 [GitHub Issues](https://github.com/lsx-xyg/blog/issues) 反馈问题、提出建议，或直接发起 Pull Request。合并要求：通过 `typecheck`、`test`、`lint` 三项检查。

## License

未声明。项目为私有仓库（`package.json` 中 `private: true`，无 license 字段），源码保留所有权利。
