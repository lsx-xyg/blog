# ADR-0010: Onborda 引导系统（配置驱动 + 独立进度追踪）

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

---

# 附录 A：引导系统 + 敏感信息查看使用说明（完整版）

> 使用说明文档（原 docs/guide-system.md 优化合并）。规格速查见 SPEC §8.1 / §8.2。

## A.1 系统概览

引导系统 = **可配置的后台新手引导** + **敏感信息查看二次验证**，通过「无密码账号」场景联动。

```
guiders 表（配置）── user_guide_progress 表（进度）── user_events 表（行为埋点）
        ↓
GuideManager（前端引擎，仅挂载 admin layout，懒加载）
  · 加载 published 引导 + 用户进度 → 条件评估 → 触发/续接
  · 步骤上报 / 完成 / 跳过
        ↓
页面只做两件事：① 埋 data-guide 锚点；② 派发 guide:trigger
```

**核心原则**：元素定位（data-guide）＝ 埋点上报（target）＝ 条件配置（value），三者同一标识，前后端对齐不漂移（注册表 `lib/guide-events.ts` 统一维护）。

## A.2 数据模型

### guiders（引导配置表）
| 字段 | 说明 |
|---|---|
| guide_key | 唯一标识带版本号（如 `reveal_password_setup_v1`）；改版换新 key，老用户自然重新触发 |
| title / page | 引导名称 / 归属后台相对路径（如 `/settings`，仅管理分类用，触发看 target_condition） |
| steps | JSONB 步骤数组（GuideStep[]） |
| status | draft / published / archived（published 才触发） |
| target_condition | JSONB 触发条件表达式（见 A.4） |
| priority | 同页面多引导可触发时排序（小者优先） |

### user_guide_progress（进度表）
user_id + guide_key，唯一约束 `UNIQUE(user_id, guide_key)`；status：not_started / in_progress / completed / skipped；in_progress 记 current_step 续接。**多账号不串扰**。

### user_events（行为事件表）
user_id / event / target / created_at；`click_count.<target>` 条件的统计源（点击一次一行）。

## A.3 前端埋点

```tsx
<button data-guide="reveal-view">查看</button>          // ① 锚点
// ② 注册表登记（lib/guide-events.ts，管理页下拉同源）
// ③ 行为触发时派发：
window.dispatchEvent(new CustomEvent("guide:trigger", {
  detail: { event: "event_click", target: "reveal-view", page: "/settings", element: e.currentTarget },
}));
```

引擎监听：`guide:trigger`（触发）/ `guide:complete`（完成，detail 可带 guideKey）/ `guide:skip`（跳过）。
步骤字段：id（自动 step_1..N）/ target（高亮锚点，必填）/ title / content / placement（卡片方位）/ nextRoute（可选，跨页跳转后台相对路径）。

## A.4 触发条件（target_condition）

```json
{ "logic": "and", "conditions": [
  { "field": "event_click", "op": "eq", "value": "reveal-view" },
  { "field": "page", "op": "eq", "value": "/settings" }
] }
```

| field | 语义 | value | 需服务端数据 |
|---|---|---|---|
| event_click | 点击某锚点（实时行为） | 锚点名 | 否（前端直判） |
| page | 触发时页面 | 后台相对路径（前缀匹配） | 否 |
| click_count.\<target\> | 点击累计次数 | 次数（gte/lte/eq） | 是（user_events） |
| user_age_days | 注册天数 | 天数 | 是（users.created_at） |

op：eq / gte / lte / exists；logic：and / or。
**精筛流程**：前端本地筛 event_click + page → 命中调 `POST /api/admin/guides/evaluate` → 服务端查 user_events / users → 全过才拉起。

## A.5 API 清单（全部需管理员 session）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | /api/admin/guides | 列表 / 创建（guideKey 查重，默认 draft） |
| PUT/DELETE | /api/admin/guides/[id] | 更新（含状态切换）/ 删除（进度保留） |
| GET/POST/DELETE | /api/admin/guides/progress | 进度查询 / upsert / 重置（?guideKey=） |
| POST | /api/admin/guides/track | 埋点上报（仅 event_click） |
| POST | /api/admin/guides/evaluate | 服务端精筛 → {matched} |

## A.6 管理页使用

入口：后台首页快捷入口卡 → `/dashboard/guides`。列表含状态徽章与操作（发布/归档/编辑/删除/重置）。编辑表单：
- **标题 / guideKey / 页面**：页面填后台相对路径（如 `/settings`，不含 adminSlug）
- **优先级**：同页面多引导同时可触发时数字小者先显示
- **触发条件**：行式表单（字段 → 比较方式 → 值，每行下方有解释）
- **引导步骤**：步骤卡片编辑器，每步含高亮元素（target，已埋点锚点下拉）、标题、卡片位置、说明、可选下一步跳转页；保存自动组装 JSON，无需手写

**重置** = 清空**当前登录账号**对该引导的进度记录（非所有用户）；重置后重新满足条件可再触发。

## A.7 进度管理规则

| 状态 | 触发行为 |
|---|---|
| 无记录 | 条件满足即触发 |
| in_progress | 从 current_step 续接 |
| completed | **永久抑制**（改版换 guide_key 重新触发） |
| skipped | **7 天冷却期**（GUIDE_SKIP_COOLDOWN_DAYS），过后可再触发 |

## A.8 敏感信息查看（Sensitive Setting Reveal）

- **输入框**：👁 切换输入内容显隐（type=password 语义）
- **label 行**：「✓ 已配置」旁「查看」按钮（不在输入框内防误触）
- 覆盖字段：github.token / s3.access_key / s3.secret_key / cron.secret / cron.job_api_key

```
有密码账号 ──点「查看」──▶ 二次验证弹窗（管理员密码）→ 解密明文，30 秒倒计时自动隐藏
无密码账号 ──点「查看」──▶ guide:trigger → onborda 引导（说明 + 跳转 /account 高亮设密表单）
                         └─ 设置成功 → guide:complete → 标记完成
```

## A.9 迁移与 Seed

```bash
npm run db:migrate        # 含 0009（guiders + progress）/ 0010（user_events + target_condition 归一化）
npx tsx scripts/seed-guides.ts   # 幂等插入 reveal_password_setup_v1
```

## A.10 验收与排障

**验收**：无密码账号 → 设置页点敏感字段「查看」→ 引导弹出 → 跳账号页设密 → 完成；之后「查看」走二次验证。
**引导不触发排查**：① published？② 进度 completed/skipped 冷却期？（管理页重置重试）③ page 条件匹配？④ 是否走 guide:trigger 分支（有密码账号点查看走验证弹窗不触发引导）⑤ 锚点三处同值？⑥ click_count/user_age_days 服务端条件满足？⑦ 控制台：onborda + framer-motion 动态加载失败会静默不弹。
