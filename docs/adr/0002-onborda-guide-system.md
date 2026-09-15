# ADR-0002: Onborda 引导系统（配置驱动 + 独立进度追踪）

- Status: **Accepted**
- Date: 2026-09-16

## Context
敏感信息二次验证（#18）遇到边界：纯 GitHub OAuth 创建的管理员账号无密码，无法使用密码二次验证。需要引导用户设置密码。同时，用户预期后台后续会新增更多引导（功能讲解、新流程引导），需要一个可扩展的引导体系，而不是一次性弹窗。

权衡方案：
- A. 前端硬编码一次性引导弹窗：最快，但无法后续扩展、无法追踪进度
- B. 完整引导系统：配置存数据库（guiders 表）、用户进度独立表（user_guide_progress）、前端 onborda 驱动

用户明确选择 B，且要求后续新增引导（guiders 表 CRUD 管理界面本轮实现）。

## Decision
- 引入 onborda（React tour 库）驱动引导展示，懒加载控制首屏体积
- 新增 **guiders 表**：引导配置（guide_key 带版本号、page、steps JSONB、status、target_condition JSONB、priority）
- 新增 **user_guide_progress 表**：用户进度，UNIQUE(user_id, guide_key)，status 枚举 not_started/in_progress/completed/skipped，记录 current_step 支持续接
- 前端新增 **GuideManager**（仅挂载后台 admin layout）：按页面 + 触发事件查询配置、查询/上报进度、触发或续接引导
- 页面通过 **data-guide 锚点**声明定位目标，GuideManager 统一解析
- 首个引导：`reveal_password_setup_v1`（无密码账号点查看 → 弹窗说明 → 跳转账号设置页高亮设置密码表单 → 设置成功标记完成）
- 后台新增「引导管理」页面（guiders CRUD：列表/新建/编辑/发布/归档）

## Consequences
- 新增引导 = 往 guiders 表插一条 published 记录 + 页面埋 data-guide 锚点，无需改前端逻辑
- 引导改版换 guide_key 版本号，老用户自然重新触发
- 多引导同页面用 priority 排序，同一时刻只触发一个
- onborda + framer-motion 依赖增加（懒加载控制）；引入前需确认 onborda 与 Next.js 15 / React 19 兼容
- 复杂度提升：DB 两张表 + 5 个 API + 前端管理器；收益是可配置、可追踪、可扩展的引导体系

## Alternatives considered
- 前端硬编码引导：被否（不可扩展、不可追踪）
- users 表加 JSONB 存进度：被否（用户明确要求独立进度表，不修改 better-auth 管理的 users 表）
