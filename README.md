# 林圣轩blog

个人技术博客：中文技术文章 + 生活相册记录。Next.js 全栈单仓，后台管理、动态配置、定时任务、引导系统都在一个仓库里。

生产地址：<https://blog.dbthree.dpdns.org>

## 技术栈

- **框架**：Next.js 15（App Router）+ React + TypeScript
- **样式**：Tailwind CSS v4 + shadcn 风格组件（@base-ui/react）
- **数据库**：Neon (PostgreSQL) + Drizzle ORM
- **认证**：Better Auth（GitHub OAuth + 账号密码 + 二次验证引导）
- **内容**：MDX（next-mdx-remote-client + Shiki 高亮）、ByteMD 编辑器（分屏 Markdown）、front-matter 标签
- **搜索**：minisearch 纯客户端搜索
- **评论**：giscus（GitHub Discussions），后台可一键开关
- **主题**：浅色 / 深色 / 护眼（warm）/ 跟随系统，cookie + localStorage 防 FOUC
- **定时任务**：文章定时发布、自动备份（cron-job.org 外部触发 / node-cron 自有服务器双实现）
- **存储**：公开（LOCAL / GitHub+jsDelivr / S3）+ 私有（LOCAL / GitHub 私有仓 / S3）双通道，敏感配置加密存储
- **部署**：Vercel（生产构建自动跑数据库迁移）

## 功能特性

- 后台管理：文章 CRUD（标签胶囊、封面图库/URL、精选标记）、相册/媒体库、友链、引导管理
- 站点设置：站点信息、存储驱动、定时任务、评论开关、高级设置，全部支持后台动态配置（环境变量 > 数据库 > 默认值）
- 引导系统（onborda）：后台可配置步骤、触发条件（页面/行为），支持 CSS 选择器拾取元素，不依赖前端改版
- 文章定时发布 + 数据库自动备份（加密后上传私有存储）
- SEO：sitemap / RSS / OG 卡片 / 结构化数据 / IndexNow 即时索引（发布自动推送）
- 四主题切换、移动端适配、文章列表拖拽排序、快捷入口

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env   # 按需填写（详见 .env.example 内注释）
# 最低必须项：DATABASE_URL / DATABASE_URL_UNPOOLED / BETTER_AUTH_SECRET / ENCRYPTION_KEY

# 3. 本地开发
npm run dev            # http://localhost:3000

# 4. 常用命令
npm run test           # vitest 单元测试
npm run typecheck      # TypeScript 类型检查
npm run build          # 生产构建
npm run analyze        # 打包体积分析（生成 .next/analyze/）
npm run lint           # ESLint
npm run db:generate    # drizzle schema 生成迁移
npm run db:migrate     # 执行迁移
```

> 配置优先级：**环境变量 > 数据库 settings 表（后台动态配置）> 代码默认值**。
> 想用后台动态配置，就不设置对应的环境变量（详见 `.env.example` 与 `docs/SPEC.md`）。

## 部署（Vercel）

1. 导入仓库，生产分支 `main`
2. 配置环境变量（同上；生产 `NEXT_PUBLIC_SITE_URL` 必须为真实域名）
3. 生产构建自动执行数据库迁移（`build = db:migrate:deploy && next build`，详见 ADR-0016）
4. 部署后访问 `{站点}/admin`（`ADMIN_PATH` 可改）进入后台

## 代码质量与 CI

每次 push / PR 自动跑两条质量流水线：

### SonarQube Cloud（代码质量分析）

- 工作流：`.github/workflows/sonarcloud.yml`（官方 `SonarSource/sonarqube-scan-action`，完整 SHA 锁定）
- 覆盖：Bug / 漏洞 / 坏味道 / 重复率 / 复杂度，质量门禁（Quality Gate）
- 配置：`sonar-project.properties`（projectKey `lsx-xyg_blog`，排除 `.next`、`public`、类型声明）
- 结果面板：<https://sonarcloud.io/dashboard?id=lsx-xyg_blog&branch=main>
- 需要 Secret：`SONAR_TOKEN`（SonarCloud 项目 → Administration → Analysis Method 生成）

### GitLeaks（密钥泄漏扫描）

- 工作流：`.github/workflows/gitleaks.yml`（官方 `gitleaks/gitleaks-action`，完整 SHA 锁定）
- 检查提交与工作区中的密钥 / Token / 凭据，发现泄漏即 job 失败并在日志标明位置
- 需要 Secret：无（`GITHUB_TOKEN` 自动提供）

> 注意：这两个工作流文件中的 action 均以完整 commit SHA 锁定（供应链安全），
> 升级版本时把 SHA 与 `# 版本号` 注释一起更新。

## 项目结构

```
app/          路由与页面（App Router，含动态 favicon / icon / apple-icon）
components/   前端组件（编辑器、媒体库、引导管理器、cron 表单等）
lib/          业务逻辑（settings 分层、guide 引导、cron、media、mdx、posts）
db/           Drizzle schema 与迁移
scripts/      运维脚本（迁移、备份、测试）
docs/         文档：SPEC.md（v1.0 冻结）、adr/（架构决策记录）、agents/
public/       静态资源（含 fonts/ 子集字体）
```

## 文档索引

| 文档 | 说明 |
|---|---|
| `docs/SPEC.md` | 产品规格（v1.0 已冻结） |
| `docs/adr/` | 架构决策记录（数据库、存储、设置分层、引导、定时任务、迁移等） |
| `PRODUCT.md` | 产品定位与用户画像 |
| `DESIGN.md` | 设计规范 |
| `CONTEXT.md` | 领域词汇表 |
| `AGENTS.md` | 仓库协作约定 |
