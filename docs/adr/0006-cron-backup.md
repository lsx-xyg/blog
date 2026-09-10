# ADR-0006: 定时任务双实现与备份

- Status: **Accepted**
- Date: 2026-09-10

## Context
Vercel serverless 无常驻进程、自带 Cron 仅每日一次；需定时发布（分钟级精度）与每日备份；备份需可下载/可恢复。

## Decision
- **固定扫描任务**（非每篇动态建任务）：幂等接口 + `CRON_SECRET` 鉴权
  - `VERCEL`：cron-job.org 固定任务触发（发布每 5 分钟、备份每日）
  - `SERVER`：node-cron 直调同一核心逻辑（默认关闭）
- **备份**：全量 JSON（业务表，不含 session/verification）→ 事务导入恢复（覆盖式、失败回滚）；上传复用 `StorageDriver`（`BACKUP_DRIVER`），`backups/` 前缀，保留 7 份
- `CRON_SECRET` 固定 token（`node:crypto` 生成）

## Consequences
- cron-job.org 无重试机制 → 幂等设计兜底，失败下次扫描自愈
- 备份含账号数据，若经 GitHub 驱动上传公开 repo 会公开账号信息（部署时权衡）
- 手动备份直接下载本地，不落存储
