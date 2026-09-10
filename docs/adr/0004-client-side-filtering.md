# ADR-0004: 纯客户端筛选架构（方案 A）

- Status: **Accepted**
- Date: 2026-09-10

## Context
参考站（czhlove.cn）标签筛选时 URL 不变（纯前端状态）；个人博客文章量小（数十篇级）；客户端搜索本就需全量索引。

## Decision
- 首页/相册启动时一次拉取**全量轻量元数据**（`/api/search-index`）
- 前端负责：瀑布流分批渲染、无限滚动、标签多选筛选、最新/精选排序、搜索
- **URL 不变**，筛选状态为前端 state
- `SEARCH_MODE=CLIENT | DATABASE` 开关：DATABASE 模式切换服务端过滤（预留）

## Consequences
- 适合数百篇以内的量级；篇数过万需改服务端分页/过滤
- 筛选、排序、搜索、瀑布流共用一份数据，实现简单、响应即时
