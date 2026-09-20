# ADR-0012: 后台关键模块架构深化（Guide 触发/表单 + Cron 分类，深模块提炼）

- Status: **Accepted**
- Date: 2026-09-17

## Context

improve-codebase-architecture 评审发现三处结构性摩擦：

1. **GuideManager 单组件扛四职责**（`guide-manager-inner.tsx` 540 行）：触发决策（条件评估、跳过、续接、首步定位）内联在组件里，最近 6 个引导 bug 全部出在调用协调而非单步逻辑——纯函数为测而抽，真正的 bug 藏在"怎么被调用"（无 locality）。
2. **引导事件是字符串约定**（3 派发 1 监听）：`event_click` vs `"event_click"` 不匹配烧过两次（#27 阶段），无类型层兜底。
3. **引导配置页巨型组件**（`manage-guides.tsx` 1345 行）：表单元数据、校验规则、条件行、步骤编辑器、保存/拾取流程全部内联，校验规则三处复制（保存/发布/拾取），行为分叉。
4. **定时任务管理页巨型组件**（`manage-cron-jobs.tsx` 1243 行）：任务分类判断（系统/孤儿/普通）内联在桌面表格与移动卡片两处渲染里，取色与 HTTP 方法名等展示决策无法单测。

## Decision

- **C1 触发决策模块化**：新增 `lib/guide/trigger.ts` 深模块（`resolveStepSelectors` / `isSkippedExpired` / `evaluateEventTrigger` / `evaluateAutoTrigger` / `decideTrigger`），14 个单测；GuideManager 退化为薄壳，只做页面/事件监听与 onborda 编排。
- **C2 事件总线类型化**：新增 `lib/guide/events.ts`（`GuideTriggerPayload` + `emitGuideTrigger` / `useGuideTrigger`，事件名常量唯一），3 个派发点统一走总线。
  - **触发元素定位原则（e7da5c3 定案）**：事件触发的引导，其步骤高亮**按步骤自身配置定位**，绝不指向触发元素（曾误用 TEMP_ANCHOR 把首步指向触发点 A，用户验收后回滚）。触发元素只作触发信号。
- **C3 配置页表单状态机拆分**：
  - `lib/guides/form-meta.ts`：表单元数据（`StepForm`/`FormState`/`EMPTY_FORM` + 字段/操作符/占位/默认值常量）
  - `lib/guides/validate.ts`：校验纯函数 `validateGuideForm` / `isConditionValid`（9 单测），保存/发布/拾取前自动保存共用同一份规则
  - `components/guide/condition-editor.tsx`（ConditionSection+ConditionRow）、`step-editor.tsx`（StepEditor）、`use-guide-form.ts`（表单状态机 hook：校验→保存 keepEditing→拾取前自动保存→打开/关闭）
  - `manage-guides.tsx` 1345 → 571 行，只留列表 + 编排。
- **C4 定时任务分类纯函数**：新增 `lib/cron/jobs.ts`（`classifyJob` 三分 system/orphan/custom + `isOrphanSystemJob` + `systemTagColor` + `methodLabel`），12 个单测；`manage-cron-jobs.tsx` 桌面表格与移动卡片统一消费 `classifyJob(job)`，删除内联三段判断。
- **深化验证标准**：每个模块先写单测再接线（TDD），验收三连 `npm run test`（当前 112 passed）→ `npm run typecheck` → `npm run build` 全绿后才提交。

## Consequences

- 触发/校验/分类等**决策逻辑可独立单测**，未来改动不再依赖"跑一遍页面"验证；组件层只保留编排与副作用，接口即测试面
- 引导事件增加类型层后，新派发点按 `GuideTriggerPayload` 编译期校验，事件名拼写错误无法通过 typecheck
- 校验规则单一来源：保存/发布/拾取三种入口行为一致（历史上"草稿空步骤""拾取前未入库步骤"等分叉已消除）
- 删除 `scripts/decrypt-cron-key.ts`（一次性调试脚本，含硬编码密文）与 `components/manage-cron.tsx`（旧版页面，0 引用）
- 深模块代价：触发/分类函数签名需稳定，调用方不得绕过（如直接查预设）以免回归内联

## Alternatives considered

- GuideManager 继续内联 + 只补测试：被否（决策与编排耦合，测试要挂 DOM，bug 藏在调用协调的场景测不到）
- 事件继续字符串约定 + 文档注释：被否（已烧过两次，类型层成本极低）
- 配置页只抽校验函数、组件不动：被否（1345 行组件仍是单点改动区，改动频繁）
- cron 分类留渲染内联：被否（两处渲染各写一遍判断，无法单测，容易再次分叉）

---

# 附录 A：C1–C4 模块速查

| 模块       | 位置                                    | 职责                                                                | 测试                |
| ---------- | --------------------------------------- | ------------------------------------------------------------------- | ------------------- |
| 触发决策   | `lib/guide/trigger.ts`                  | decideTrigger（进度抑制+条件+续接+needsServer）、条件评估、首步定位 | 14                  |
| 事件总线   | `lib/guide/events.ts`                   | GuideTriggerPayload / emitGuideTrigger / useGuideTrigger            | —（typecheck 兜底） |
| 表单元数据 | `lib/guides/form-meta.ts`               | FormState/StepForm/EMPTY_FORM + 字段/操作符常量                     | —                   |
| 表单校验   | `lib/guides/validate.ts`                | validateGuideForm / isConditionValid                                | 9                   |
| 条件编辑器 | `components/guide/condition-editor.tsx` | ConditionSection + ConditionRow（含拾取元素）                       | —                   |
| 步骤编辑器 | `components/guide/step-editor.tsx`      | StepEditor（锚点 datalist + 拾取按钮）                              | —                   |
| 表单状态机 | `components/guide/use-guide-form.ts`    | 校验→保存（keepEditing）→拾取前自动保存→打开/关闭                   | —                   |
| cron 分类  | `lib/cron/jobs.ts`                      | classifyJob / isOrphanSystemJob / systemTagColor / methodLabel      | 12                  |
