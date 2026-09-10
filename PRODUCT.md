# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 App Router + TypeScript + Tailwind CSS + Drizzle ORM + Neon (PostgreSQL) + Better Auth；MDX（next-mdx-remote-client + Shiki）；Milkdown 编辑器；minisearch 客户端搜索；giscus 评论；部署 Vercel。详见 docs/SPEC.md（v1.0 已冻结）。

## Users

- 主要用户：博客作者本人（林圣轩 / CourtMate），写中文技术文章 + 记录生活照片。
- 读者 a：中文开发者/技术同行，读技术文章、学架构；读者 b：亲友，看生活相册。
- 情境：桌面端 + 移动端浏览；读者来阅读、搜索、按标签筛选、评论。

## Product Purpose

个人博客：技术写作与生活记录的公开归档。成功 = 作者持续写作、读者轻松阅读与检索、站点零成本长期稳定运行（Vercel 免费层起步，后期可换自有服务器）。

## Positioning

纯粹的个人记录，不追流量。同时博客本身是开源的完整 Next.js 实现，SPEC/ADR/代码全部公开，架构对读者透明。

## Operating Context

- 写作：后台 Milkdown 编辑器写 Markdown/MDX；文章可定时发布（VERCEL 模式走 cron-job.org，SERVER 模式走 node-cron）。
- 浏览：桌面 + 移动；三色主题 light/dark/sepia，跟随系统 + 手动记忆。
- 内容组织：首页（文章瀑布流 + 标签多选筛选 + 最新/精选切换）、相册（图片瀑布流 + 标签筛选 + 精选）、关于、友链。
- 评论：giscus（GitHub Discussions，iframe 内独立 OAuth，与后台登录隔离）。
- 部署：Vercel（起步）→ 可换自有服务器；域名 blog.dbthree.dpdns.org 经 Cloudflare DNS 解析。
- 管理：密码 + GitHub 登录 + 账号关联；用户表空时 /admin 引导，首个登录者为管理员；真实后台路径 ADMIN_PATH（env 优先 → DB settings）。

## Capabilities and Constraints

- 规格冻结：docs/SPEC.md v1.0（16 章）；ADR 0001-0006 已接受。
- 数据库 9 张表；存储抽象 StorageDriver（VERCEL_BLOB | S3 | GITHUB，视频不走 GitHub）；备份 = 全量 JSON + 复用存储驱动。
- 搜索 SEARCH_MODE=CLIENT|DATABASE 开关，起步 CLIENT（minisearch）。
- 约束：env 全大写 + 小写转大写兜底；DB 枚举全大写；标签名原样存储、大小写敏感；giscus 依赖公开仓库。
- 明确未决：站点正式名称（暂用 blog 占位）、Logo（待设计）。

## Brand Commitments

- 作者署名：林圣轩 / CourtMate。
- 站点名：暂用 blog 占位，可后改。
- 需要 Logo（待设计）。
- 参考站 czhlove.cn：三色主题、瀑布流、移动端适配——用户明确指定的视觉参考。

## Evidence on Hand

- docs/SPEC.md v1.0（已冻结）；docs/adr/0001-0006（已接受）；AGENTS.md + docs/agents/（issue-tracker / triage / domain / skill-workflow）。
- 参考站 czhlove.cn 结构已核实：首页 = 站点简介 + 文章列表 + 横排标签筛选（URL 不变）+ 最新/精选切换 + 加载更多。

## Product Principles

1. 零成本起步：免费层跑通（Vercel + Neon + 免费域名），后期按需付费。
2. 平台可替换：平台依赖全部走抽象层（StorageDriver / DeployPlatform / CronProvider / BackupDriver），换平台不改业务代码。
3. 写作即核心：Markdown/MDX 优先，图片最小化存储（懒加载 + CDN）。
4. 前台克制、后台完备：读者端极简专注阅读，管理端功能完整。
5. 中文优先：不做国际化。

## Accessibility & Inclusion

- 三色主题，护眼 sepia rgb(214,209,194)。
- 桌面 + 移动端响应式适配。
- 图片懒加载；阅读排版可读性优先。
