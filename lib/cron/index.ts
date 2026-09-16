/**
 * lib/cron 兼容聚合层（旧调用方入口）
 *
 * C2 拆分后职责划分：
 * - client.ts：cron-job.org HTTP 适配器（apiRequest + 8 个 CRUD 转发）
 * - service.ts：系统任务业务（预设创建 / 查找 / 状态聚合）
 * - system-jobs.ts：系统任务预设表
 *
 * 本文件仅为历史调用方（API 路由等）保留统一入口，新代码应直接
 * 从 client / service 分别导入，明确依赖方向。
 */
export * from "./client";
export * from "./service";
