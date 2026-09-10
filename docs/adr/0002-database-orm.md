# ADR-0002: 数据库选型与 ORM

- Status: **Accepted**
- Date: 2026-09-10

## Context
需 PostgreSQL，内容（文章 Markdown、相册、设置）入库；免费起步、可迁移；拒绝"一站式免费平台"（单一平台宕机风险）。

## Decision
- Neon (PostgreSQL) + Drizzle ORM（schema 即代码）
- 业务表：posts / tags / post_tags / gallery_items / gallery_item_tags / settings / friend_links / backup_records + Better Auth 表
- 枚举值全大写（STATUS ∈ {DRAFT, SCHEDULED, PUBLISHED} 等）
- 标签 `name` 原样存储、大小写敏感去重，`slug` 唯一

## Consequences
- 迁移路径：换 `DATABASE_URL` 即可迁至任意 PG（含未来自有服务器）
- 标签严格区分大小写，`Nextjs` ≠ `nextjs`
