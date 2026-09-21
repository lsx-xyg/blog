# ADR-0016: 部署阶段自动执行数据库迁移

- Status: **Accepted**
- Date: 2026-09-21

## Context

迁移 SQL 由 `drizzle-kit generate` 在本地生成、随代码入库（`db/drizzle/`），但**生成 ≠ 执行**：
只有跑 `migrate` 才会真正落到 Neon 上。Vercel 侧只执行 `next build`，于是每次带新迁移的推送
都会出现「新代码 + 旧 schema」——新增的列 / 表在线上根本不存在，相关页面直接 500，
必须回本地手动 `npm run db:migrate` 才能修好。

约束：

- 线上是 serverless（ADR-0001）：无常驻进程，不适合「应用启动时迁移」（多实例并发）
- 预览部署与生产**共用同一个 Neon 数据库**（同一个 `DATABASE_URL`）
- 迁移必须走非池化直连（`DATABASE_URL_UNPOOLED`）
- 项目纪律是文档/决策先行，需要单一事实来源描述这条策略

## Decision

**把迁移挂到构建阶段**，并让「这次要不要迁移」由一个纯函数统一判定。

1. **入口**：`package.json` 的 `build` = `npm run db:migrate:deploy && next build`。
   Vercel 的 Next.js 预设执行的正是 `scripts.build`（Vercel KB《Conditional Build Commands》：
   "If Next.js is your framework, Vercel looks for a build script in scripts and runs it"），
   因此线上构建前会先跑迁移，**不需要改 Vercel 后台配置**。
2. **脚本**：`scripts/db/migrate.ts --deploy`（npm script：`db:migrate:deploy`）。相比
   `drizzle-kit migrate` 额外提供：真实错误输出、环境判定、跨构建互斥、连接重试、应用计数日志。
3. **判定**：`lib/db/shared/deploy-migrate.ts` 的 `decideMigrate()`（纯逻辑 + 单测 23 例）：

   | 场景                        | 行为                                                             |
   | --------------------------- | ---------------------------------------------------------------- |
   | 手动执行（不带 `--deploy`） | 迁移（本地 `db:migrate:debug` 行为不变）                         |
   | Vercel 生产构建             | 迁移                                                             |
   | Vercel 预览 / 开发构建      | 跳过（与生产共用数据库，避免未合并分支的 schema 变更污染生产库） |
   | 本地 `npm run build`        | 跳过（构建不碰数据库）                                           |
   | `MIGRATE_ON_DEPLOY=1`       | 强制迁移（本地 / Preview / 其他 CI 想迁移时用）                  |
   | `SKIP_DB_MIGRATE=1`         | 强制跳过（应急开关，优先级最高）                                 |

4. **并发**：迁移前取 PG 咨询锁（`pg_try_advisory_lock`，最长等 60s）。两次构建同时到达时只有
   一个真正执行，另一个等它做完再判定（此时已无待应用迁移），避免 `relation already exists`。
5. **连接**：优先 `DATABASE_URL_UNPOOLED`（直连），缺失时回退 `DATABASE_URL` 并告警；
   连接失败退避重试 3 次，容忍 Neon 冷启动。

## Consequences

- **迁移失败 = 构建失败 = 不部署**，fail fast 好过线上跑「新代码 + 旧 schema」。构建日志即迁移日志。
- Vercel 项目的 Build Command 必须保持默认（别覆盖成 `next build`，否则绕过迁移）。
- 构建期必须装上 devDependencies：`tsx` 是 devDependency，所以项目**不要**在 Vercel 设
  `NODE_ENV=production`（会让 `npm install` 走 production 模式，装不上 tsx）。若确实需要设，
  把 Install Command 改成 `npm install --production=false`。
- 构建期能读到数据库变量：Vercel 会把项目环境变量（含 Sensitive，仅静态加密）解密后注入构建容器；
  本项目的 `sitemap` / RSS / 文章页预渲染本来就在构建期查库，因此没有新增前置条件。
- schema 迁移**没有 down 迁移**：回滚要手写 SQL，所以删列 / 改类型这类破坏性变更仍建议
  拆成「先兼容发布、再清理发布」两次。
- 本地开发流程不变：改 `db/schema.ts` → `npm run db:generate` → `npm run db:migrate`。

## Alternatives considered

- **在 `vercel.json` 写 `buildCommand`**：效果等价，但多一层配置来源（vercel.json > 后台设置 >
  框架预设），且让本地 `npm run build` 与线上不一致；当前用 `scripts.build` 认知负担更小。
- **应用启动时迁移**（instrumentation / 首次请求懒执行）：serverless 多实例并发迁移有竞态，
  冷启动还会被迁移拖慢，否决。
- **GitHub Actions 单独跑迁移**：多一套 secrets 与一条独立流水线，且与部署非原子（迁移成功但
  部署失败的窗口期），否决。
- **直接把 `drizzle-kit migrate` 放进 build**：CLI 出错信息不友好，且没有环境判定与跨构建互斥，否决。
