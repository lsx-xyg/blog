# ADR-0001: Next.js 全栈架构与部署

- Status: **Accepted**
- Date: 2026-09-10

## Context
个人博客 + 相册，前后端一体，内容存数据库，作者无 Next.js 经验（有 React 基础）。要求免费起步、不买服务器、后期可迁自有服务器。

## Decision
- Next.js 15（App Router）+ TypeScript，前后端一体
- 部署 Vercel（免费起步），域名走 Cloudflare → Vercel
- `DEPLOY_PLATFORM=VERCEL | SERVER` 预留迁自有服务器的分支

## Consequences
- Serverless 限制：无常驻进程、自带 Cron 仅每日一次 → 外部 cron 方案（见 ADR-0006）
- 从零搭建（非模板 fork），参考 czhlove.cn 的结构与交互
