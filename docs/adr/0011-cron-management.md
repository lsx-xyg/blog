# ADR-0011: 后台定时任务管理（cron-job.org 管理 UI + 系统任务预设驱动）

- Status: **Accepted**
- Date: 2026-09-16

## Context

cron-job.org 免费版每日仅 100 次 API 请求，后台定时任务管理页此前存在三方面问题：

1. **配额浪费**：页面打开自动加载状态（每进一次页面就消耗 1-2 次 API）
2. **能力缺失**：无执行历史、无响应查看、任务表单缺认证/通知等官方能力（#19-#23）
3. **结构重复**：「全局定时任务发布」区块与任务列表展示同一任务；且发布任务可能不止一个（备份/清理等），命名与结构都不合理；`stop` 语义为直接删除任务，执行历史随之丢失

## Decision

- **配额约束设计**（贯穿所有 cron 页面）：
  - 页面打开**零 API 请求**，由「加载状态 / 加载任务列表」按钮按需触发（一按钮一 API）
  - 「刷新全部」一次性触发全部（当前 2 个 API）
  - 操作成功后只刷新关联数据（启停→状态，增删改→任务），不连带其他请求
- **系统任务预设驱动**：新增 `lib/cron/system-jobs.ts`，`SYSTEM_JOB_PRESETS` 预设数组（key/name/description/createConfig），当前 1 个：`publish_scheduled` 定时发布扫描。任务 title 固定 `[系统] <名称>` 前缀；匹配兼容历史任务（旧 title「博客定时发布扫描（每分钟）」按名称包含判断）
- **启停语义改为 PATCH enabled**：`start` = 已存在则启用、不存在则按预设创建；`stop` = PATCH `enabled=false`（**不删除**，保留任务与执行历史）；彻底删除走任务列表 `DELETE /api/admin/cron/jobs/[id]` 或系统任务区删除按钮
- **命名**：「全局定时任务发布」→「系统定时任务」，区块改为预设任务列表（名称/描述/状态/启停/手动触发/删除）；任务列表中对系统任务打「系统」徽章，两者不视为重复（配置视图 vs 完整视图）
- **总览接口** `GET /api/admin/cron` 改为一次 `listCronJobs` 匹配全部预设，返回 `systemJobs` 状态数组（key/name/description/supportsRun/enabled/jobId/nextRun）
- **cron 管理能力**（#19-#23）：执行历史弹窗（按需加载列表与详情）、响应查看弹窗（JSON 格式化/100k 截断/敏感提醒）、任务表单通知设置分区、HTTP 基本认证子分区
- **执行历史字段对齐 cron-job.org 官方结构**（2026-09-16 修复，提交 `65eb12a`）：
  - 列表项字段：`jobLogId / jobId / identifier(字符串) / date(实际执行) / datePlanned / jitter / url / duration / status / statusText / httpStatus / headers / body / stats / sslCertExpiry`；官方列表**没有** `id / execution` 字段，曾误映射导致时间显示缺失、展开判断全等（所有 `item.id=undefined`）
  - **状态展示以 `statusText` 文本为准**（OK / REQUEST_FAILED / NO_RESPONSE / TIMEOUT / SSL_CERT_INVALID / REQUEST_TOO_LARGE / INTERNAL_ERROR / FAILING_SINCE），不依赖数字枚举——实测 `status=1` 可配 `statusText="OK"` 且 `httpStatus=200`，数字语义与旧文档不符
  - 详情接口返回 **`jobHistoryDetails`**（对象）；请求标识符为字符串 identifier（如 `8440447-16-8-204`），**禁止 `parseInt`**（曾导致 404）；展开状态用 `jobLogId` 唯一标识
  - `stats` 为**微秒**（nameLookup/connect/appConnect/preTransfer/startTransfer/total），展示前转毫秒；`headers`/`body` 为原始文本（false 表示未保存）
- **文档**：使用说明并入本文档附录 A（原 docs/cron-management.md 优化合并）

## Consequences

- 配额可控：日常操作每次点击最多消耗 1 次 API，刷新全部 2 次；文档给出各操作消耗参考
- 系统任务扩展 = 往 `SYSTEM_JOB_PRESETS` 追加预设（名称/描述/创建配置），总览与启动逻辑自动适配
- 停止不再删除任务，历史可回溯；语义与 cron-job.org 官方「启用/禁用」一致
- `findGlobalPublishJob` / `createGlobalPublishJob` 保留为兼容入口，内部走预设
- SERVER 模式（node-cron）不受影响：内置任务随应用启动自动运行

## Alternatives considered

- 「全局定时任务发布」区块保留 + 只改 stop 语义：被否（区块与任务列表重复展示未解决，命名无法覆盖多系统任务）
- 系统任务配置落数据库表：暂缓（当前仅 1 个预设，代码预设足够；未来系统任务增多再配置化，避免过度设计）
- 页面保持自动加载：被否（免费配额每天 100 次，自动加载每次进页消耗）

---

# 附录 A：后台定时任务管理使用说明

## A.1 API 清单（前缀 /api/admin/cron，全部需管理员 session）

| 方法             | 路径                                 | 说明                                                   | lib/cron 函数                                   |
| ---------------- | ------------------------------------ | ------------------------------------------------------ | ----------------------------------------------- |
| GET              | /cron                                | 总览（平台/密钥/系统任务状态列表/接口地址）            | listSystemJobsStatus                            |
| POST             | /cron/start                          | 启动系统任务（存在则启用，不存在则创建；body `{key}`） | findSystemJob / createSystemJob / updateCronJob |
| POST             | /cron/stop                           | 停止系统任务（PATCH enabled=false；body `{key}`）      | findSystemJob / updateCronJob                   |
| POST             | /cron/run                            | 手动触发定时发布扫描                                   | —                                               |
| GET/POST         | /cron/jobs                           | 任务列表 / 创建（url 必填）                            | listCronJobs / createCronJob                    |
| GET/PATCH/DELETE | /cron/jobs/[id]                      | 详情（含 auth/notification/extendedData）/ 更新 / 删除 | getCronJob / updateCronJob / deleteCronJob      |
| GET              | /cron/jobs/[id]/history              | 执行历史列表                                           | getJobHistory                                   |
| GET              | /cron/jobs/[id]/history/[identifier] | 单次执行详情（响应头/体/性能统计）                     | getJobHistoryDetail                             |

## A.2 配额约束与消耗参考

- 页面打开 **0 次** API；「加载状态 / 加载任务列表」各 1 次；「刷新全部」2 次
- 创建/编辑任务 1 次；启停 1 次；打开历史弹窗 1 次；点单条详情 1 次；响应查看 0 次（随详情返回）
- 编辑任务打开即消耗 1 次（拉取详情回填 headers/auth/notification）

## A.3 页面操作

- **总览页**：状态概览 4 卡（平台/CRON_SECRET/CRON_JOB_API_KEY/系统任务运行数）→ 「系统定时任务」列表（每行：状态点、名称、描述、下次执行、任务 ID、启停/手动触发/删除）
- **任务管理页**：单列表布局。系统任务见「系统定时任务」区（启停/手动触发/编辑/历史/删除，编辑从详情接口完整回填表单），「我的定时任务」列表仅显示用户自建任务（行内：执行历史/启用禁用/编辑/删除）
- **任务表单**：基本信息（标题/URL/方法/超时/启用/保存响应/3xx）→ 调度配置 → 通知设置（折叠）→ 高级配置（请求头/请求体/HTTP 基本认证，折叠）
- **执行历史**：状态徽章按官方 `statusText` 展示（OK 绿 / TIMEOUT、REQUEST_TOO_LARGE 黄 / 其余红），OK 时附 HTTP 状态码；行内显示实际执行时间（`date`）、时长、请求 URL；单条详情含状态、实际/计划执行、抖动、执行时长、请求 URL、性能统计（DNS 查询/连接/TLS 握手/首字节/总时长，`stats` 微秒换算）、响应查看
- **响应查看**：saveResponses 开启且有数据时显示；响应头原始文本按行解析 + 响应体 JSON 美化/原样，超 100,000 字符截断，含敏感信息提醒

## A.4 系统任务预设扩展

新增系统任务：`lib/cron/system-jobs.ts` 的 `SYSTEM_JOB_PRESETS` 追加一项（key 唯一 / name / description / supportsRun? / createConfig）。总览与启停逻辑自动适配；新任务 title 建议 `[系统] <名称>（<周期>）`。

## A.5 部署与环境

- VERCEL：需 `CRON_SECRET`、`CRON_JOB_API_KEY`（设置页可配）、站点 URL
- SERVER：node-cron 内置，应用启动即运行（见 ADR-0006）
- 免费配额在 cron-job.org 账号设置页可查；接近上限避免频繁「刷新全部」
