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

## 修订

- **2026-09-21｜保留策略改为可配置**：原决策写死「保留 7 份」，且长期未实现（历史备份只增不减）。
  现改为后台可配置：**保留天数 / 保留条数**（`0` = 不限制，两项任一超限即清理），
  在每次 `createBackup()` 后自动执行，另提供后台「立即清理」手动触发；
  无论怎么配都至少保留最新一份（安全阀）。
  清理复用 `deleteBackup()`，因此同样写审计日志并删除存储中的文件。
- **2026-09-21｜备份存储改走通道绑定**：`BACKUP_DRIVER` 单一驱动的做法已被存储档案池取代——
  备份通道（`storage.binding.backup`）绑定到某个档案，可回退旧版 `STORAGE_PRIVATE_DRIVER` 配置。
