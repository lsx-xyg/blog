# 引导系统 + 敏感信息查看（Guide System & Sensitive Setting Reveal）

> 状态：已上线（2026-09-16）
> 相关：docs/SPEC.md §8.1 / §8.2、docs/adr/0002-onborda-guide-system.md、CONTEXT.md「Onboarding Guide」术语组
> 需求来源：#18（敏感信息回显二次验证）+ 引导体系设计讨论（grill-with-docs 质询锁定）

---

## 1. 系统概览

引导系统 = **可配置的后台新手引导** + **敏感信息查看二次验证**。二者通过「无密码账号」场景联动：

```
┌─────────────────────────────────────────────────────────┐
│  guiders 表（配置：引导长什么样）                          │
│  user_guide_progress 表（进度：用户走到哪了）              │
│  user_events 表（行为：点击埋点，click_count 数据源）      │
├─────────────────────────────────────────────────────────┤
│  GuideManager（前端引擎，仅挂载 admin layout，懒加载）      │
│  · 加载 published 引导 + 当前用户进度                     │
│  · 监听 guide:trigger 事件 → 条件评估 → 触发/续接          │
│  · 步骤上报 / 完成 / 跳过                                 │
├─────────────────────────────────────────────────────────┤
│  页面只做两件事：                                        │
│  ① 埋 data-guide 锚点                                    │
│  ② 派发 guide:trigger（行为触发，如点击「查看」）          │
└─────────────────────────────────────────────────────────┘
```

**关键设计原则**：元素定位（data-guide）＝ 埋点上报（target）＝ 条件配置（value），三者用**同一个标识**，前后端和运营对齐不漂移（注册表 `lib/guide-events.ts` 统一维护）。

---

## 2. 数据模型

### 2.1 `guiders` 引导配置表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| guide_key | text UNIQUE | 唯一标识，带版本号（如 `reveal_password_setup_v1`）；改版换新 key，老用户自然重新触发 |
| title | text | 引导名称（管理页展示） |
| page | text | 归属页面（后台相对路径，如 `/settings`），管理分类用；**触发判定看 target_condition** |
| steps | jsonb | 步骤数组（GuideStep[]，见 §3.2） |
| status | guide_status | draft / published / archived（published 才触发） |
| target_condition | jsonb | 触发条件表达式（见 §4） |
| priority | int | 同页面多引导可触发时的排序（小者优先） |
| created_at / updated_at | timestamp | |

### 2.2 `user_guide_progress` 用户进度表

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | text FK→user | 进度按用户独立追踪 |
| guide_key | text | 关联配置表 |
| status | guide_progress_status | not_started / in_progress / completed / skipped |
| current_step | int | in_progress 时记录当前步骤，下次续接 |
| started_at / completed_at | timestamp | |

唯一约束 `UNIQUE(user_id, guide_key)`。**多账号不串扰**。

### 2.3 `user_events` 用户行为事件表

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | text FK→user | |
| event | text | 事件类型（当前固定 `event_click`） |
| target | text | 锚点名（与 data-guide 同值） |
| created_at | timestamp | |

用途：`click_count.<target>` 条件的统计源（点击一次记一行）。

---

## 3. 前端埋点（页面要做什么）

### 3.1 锚点写法

给目标元素加自定义属性：

```tsx
<button type="button" data-guide="reveal-view">查看</button>
```

引擎定位：`document.querySelector('[data-guide="reveal-view"]')`。**不依赖 class 和层级**。

### 3.2 埋点注册表

新增锚点时，在 `lib/guide-events.ts` 登记（管理页下拉选项同源，不怕手写错）：

```ts
export const GUIDE_EVENT_ANCHORS: GuideEventAnchor[] = [
  { target: "reveal-view", label: "敏感信息「查看」按钮（设置页）", page: "/settings" },
  { target: "account-set-password", label: "账号设置密码表单", page: "/account" },
];
```

### 3.3 触发事件派发

行为触发（如点击按钮）时派发统一事件：

```ts
window.dispatchEvent(
  new CustomEvent("guide:trigger", {
    detail: {
      event: "event_click",       // 固定值 GUIDE_TRIGGER_EVENT
      target: "reveal-view",      // 锚点名（data-guide 同值）
      page: "/settings",          // 当前页面
      element: e.currentTarget,   // 触发元素（第一步高亮它）
    },
  })
);
```

其他引擎监听事件：`guide:complete`（完成，detail 可带 guideKey，不带则用当前 tour）、`guide:skip`（跳过）。

### 3.4 步骤（GuideStep）字段

| 字段 | 必填 | 说明 |
|---|---|---|
| id | ✓ | 步骤 ID（自动生成 step_1..N） |
| target | ✓ | 高亮元素锚点名（data-guide 值） |
| title | ✓ | 卡片标题 |
| content | ✓ | 卡片说明文字 |
| placement | 选 | top / bottom / left / right（卡片出现在元素哪一侧） |
| nextRoute | 选 | 下一步跳转的后台相对路径（如 `/account`），用于跨页引导 |

---

## 4. 触发条件（target_condition）

```json
{
  "logic": "and",
  "conditions": [
    { "field": "event_click", "op": "eq", "value": "reveal-view" },
    { "field": "page", "op": "eq", "value": "/settings" }
  ]
}
```

| 字段 | 语义 | value 填什么 | 是否需要服务端数据 |
|---|---|---|---|
| event_click | 用户点击了某锚点元素（实时行为） | 锚点名（data-guide 同值） | 否（前端直接判） |
| page | 触发时用户在哪个页面 | 后台相对路径（前缀匹配） | 否 |
| click_count.&lt;target&gt; | 点击累计次数达到才触发 | 次数（配 op=gte/lte/eq） | **是**（user_events 统计） |
| user_age_days | 注册满多少天 | 天数 | **是**（users.created_at 计算） |

op：`eq`（等于）/ `gte`（≥）/ `lte`（≤）/ `exists`（存在）。
logic：`and`（全部满足）/ `or`（任一满足）。

**含服务端条件的评估流程**：前端本地先筛 event_click + page → 命中后调 `POST /api/admin/guides/evaluate` 精筛（服务端查 user_events / users）→ 全部通过才拉起引导。

---

## 5. API 清单（全部需管理员 session）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/admin/guides?status=published | 引导列表（管理页全量；引擎按 published 过滤） |
| POST | /api/admin/guides | 创建引导（guideKey 查重，默认 draft） |
| PUT | /api/admin/guides/[id] | 更新（含状态切换 draft/published/archived） |
| DELETE | /api/admin/guides/[id] | 删除配置（进度记录保留） |
| GET | /api/admin/guides/progress | 当前用户全部引导进度 |
| POST | /api/admin/guides/progress | 上报/upsert 进度 {guideKey, status?, currentStep?} |
| DELETE | /api/admin/guides/progress?guideKey= | 重置当前用户该引导进度（可重新触发） |
| POST | /api/admin/guides/track | 埋点上报 {event, target}（仅接受 event_click） |
| POST | /api/admin/guides/evaluate | 服务端精筛 {guideKey, event, target, page} → {matched} |

---

## 6. 管理页使用说明

**入口**：后台首页（dashboard）快捷入口卡片区 → 「引导管理」卡 → `/dashboard/guides`。

### 6.1 列表

| 列 | 说明 |
|---|---|
| 标题 / guideKey / 页面 | 基础信息（页面 = 归属页，后台相对路径） |
| 触发条件 | 条件字段摘要（如 event_click · page） |
| 优先级 / 步骤 / 状态 | 步骤数、草稿/发布/归档徽章 |

**操作按钮**：🚀 发布（草稿→published）、🗂 归档、✏️ 编辑、🗑 删除（二次确认）、↻ **重置**。

### 6.2 新建 / 编辑表单

- **标题**：引导名称（仅管理页展示）
- **guideKey**：唯一标识，带版本号（如 `reveal_password_setup_v1`）。改版换新 key（`_v2`），已看过的用户自动重新触发
- **页面**：后台相对路径。后台地址是 `/<adminSlug>/settings`，这里填 `/settings`（不含 adminSlug）
- **优先级**：同页面多引导可同时触发时，数字小的先显示
- **状态**：草稿不触发 / 发布生效 / 归档停用
- **触发条件**：行式表单（条件字段 → 比较方式 → 值，每行下方有字段解释）。满足逻辑：全部满足（and）/ 任一满足（or）
- **引导步骤**：步骤卡片编辑器。每步：高亮元素（target，带已埋点锚点下拉提示）、标题、卡片位置、说明文字、可选下一步跳转页面。保存时自动组装 JSON，**无需手写**

### 6.3 重置进度

**重置 = 清空当前登录账号对该引导的进度记录**（不是所有用户）。引导触发过、你点过「跳过」或「完成」后记一笔，防重复打扰；重置后重新满足触发条件即可再次弹出。

---

## 7. 进度管理规则

| 状态 | 触发行为 |
|---|---|
| 无记录 | 条件满足即触发 |
| in_progress | 从 current_step 续接（目标元素在当前页面则跳到该步） |
| **completed** | **永久抑制**（改版用新 guideKey 重新触发） |
| **skipped** | **7 天冷却期**（GUIDE_SKIP_COOLDOWN_DAYS）：期内不触发，超过后允许重新触发 |

手动干预：管理页「重置」按钮（见 §6.3）。

---

## 8. 敏感信息查看（Sensitive Setting Reveal）

### 8.1 交互形态

- **输入框**：敏感字段输入框内 👁 切换输入内容显示/隐藏（type=password 语义，`pr-10`）
- **label 行**：「✓ 已配置」旁有「查看」按钮（不在输入框内，防误触）
- 覆盖字段：`github.token` / `s3.access_key` / `s3.secret_key`（设置页）、`cron.secret` / `cron.job_api_key`（设置页 cron 区块）

### 8.2 两条路径

```
有密码账号 ──点击「查看」──▶ 二次验证弹窗（输入管理员密码）
                           └─▶ 解密展示明文，30 秒倒计时自动隐藏

无密码账号 ──点击「查看」──▶ 派发 guide:trigger
                           └─▶ onborda 引导：说明需先设置密码
                               └─「下一步」跳转 /account 高亮设置密码表单
                                   └─ 设置成功 → 派发 guide:complete → 标记完成
```

---

## 9. 迁移与 Seed

```bash
npm run db:migrate                          # 应用全部迁移（含 0009/0010）
npx tsx scripts/seed-guides.ts              # 插入首个引导 reveal_password_setup_v1（幂等）
```

- 迁移 0009：guiders + user_guide_progress 两表
- 迁移 0010：user_events 表 + 存量 target_condition 归一化（旧 `{event,page}` → `{logic,conditions[]}`，事件名 reveal-click → 锚点 reveal-view）

---

## 10. 验收与排障

**验收路径**：无密码账号 → 后台设置页 → 任意敏感字段点「查看」→ 引导弹出 → 下一步 → 账号页设置密码 → 完成。之后「查看」走二次验证弹窗。

**引导不触发的排查清单**：

1. 引导是否 published？（管理页状态）
2. 进度是否 completed / skipped 未过冷却期？（管理页「重置」后重试）
3. 当前页面与条件 page 是否匹配？（后台相对路径前缀）
4. 事件是否派发？（点击的按钮需走 `guide:trigger` 分支；有密码账号点「查看」走验证弹窗，**不触发引导**）
5. 锚点值是否一致？（data-guide = detail.target = 条件 value，三处必须同值）
6. 服务端条件（click_count / user_age_days）是否满足？（调 evaluate API 精筛）
7. 浏览器控制台：onborda 依赖 framer-motion，动态加载失败会静默不弹
