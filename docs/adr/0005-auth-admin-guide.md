# ADR-0005: 认证、后台入口与引导机制

- Status: **Accepted**
- Date: 2026-09-10

## Context
需密码 + GitHub 双登录 + 账号关联；后台路径防猜测；单人博客的管理员产生机制。

## Decision
- Better Auth（Auth.js 已并入，官方推荐新项目）
- **引导流程**：用户表为空时 `/admin` 开放，GitHub 登录首个用户即置 `is_admin=true`；可选 `SETUP_SECRET` 防抢注
- 引导完成后 `/admin` 永久 404
- 真实入口 `ADMIN_PATH`（env 优先 → DB settings 覆盖），动态路由 `/[adminSlug]`，不匹配一律 404 伪装
- 前台登录用户（is_admin）显示"管理"按钮
- 评论区 giscus 登录与后台登录完全隔离（iframe 内独立 OAuth App）

## Consequences
- 随机路径负责隐藏、Better Auth 负责认证，两层独立
- 部署后需尽快完成引导，或设置 SETUP_SECRET 堵抢注窗口
