# ADR-0013: 架构深化第二轮（C5–C8）——引导展示映射 / 管理页骨架 / 设置页密钥 / Cron 动作决策

- Status: **Accepted**
- Date: 2026-09-17

## Context
ADR-0012 完成 C1–C4 后，第二轮评审（improve-codebase-architecture）继续沿相同方向深挖四个候选：

1. **C5（Strong）**：C1 只提炼了触发决策，`maybeStartGuide` 里仍有 30 行「DB 步骤 → onborda Step」展示映射内联（nextRoute 拼接、placement→side、选择器命中检测），无任何测试；nextRoute 拼接与选择器选择恰是引导链路历史 bug 高发区。
2. **C6（Worth exploring）**：六个管理页虽已统一公共原子（AdminPageHeader/SearchInput/Status），但每页仍各写 80–120 行骨架（工具行、loading/empty 三元、按钮模板），「统一样式」类改动一次要动六处。
3. **C7（Worth exploring）**：`manage-settings.tsx` 894 行，明文查看 30 秒倒计时状态机（reveal 时间戳 + 两个 effect）内联且无法单测。
4. **C8（Speculative）**：cron 任务动作按钮可见性（系统/普通任务分支）内联在桌面表格与移动卡片两处渲染。

## Decision
- **C5 展示映射纯函数**：新增 `lib/guide/tour.ts`——`buildTourSteps(guide, adminPath, { isHit, onMiss })`（选择器多级解析 / placement→side / nextRoute 拼接 / 命中检测 / 失效上报分发），`pickSelector`（非法选择器跳过 + 全未命中返回首个供 onborda 兜底）。DOM 查询经 `isHit` 注入、上报经 `onMiss` 回调注入，函数无副作用。12 个单测；GuideManager 的 maybeStartGuide 只剩决策调用 + 副作用编排。
- **C6 管理页骨架组合化**：新增 `components/admin/list-page.tsx`（AdminListPage：header + 错误条 + 搜索/筛选行 + loading/empty 门 + children 插槽）与 `components/admin/action-buttons.tsx`（CreateButton/RefreshButton 统一按钮模板：移动端只图标、禁用/加载态内置）。六页（posts/friend-links/media/tags/backup/guides）全部改造，保留各自专属内容（posts 批量工具栏、media 清理面板/分页、backup 三按钮/块标题、guides 失效监控面板）。
- **C7 设置页密钥状态机**：新增 `lib/settings/secret-reveal.ts` 纯 reducer（reveal 重置 30s / tick 递减 / 归零自动隐藏），6 单测；新增 `components/settings/cron-section.tsx` 自持 cron 密钥完整交互（二次验证弹窗 / 明文倒计时 / 输入框 👁 / 无密码引导），`manage-settings.tsx` 894 → 701。
  - **storage 分区保留内联**：59 行薄块，核心逻辑已在 StorageConfigForm，拆出去只是搬移、删除测试不成立。
- **C8 cron 动作集合决策**：`lib/cron/jobs.ts` 新增 `availableActions(job, cls)`（系统任务：启停+手动触发+编辑/历史/删除；普通任务：切换+编辑/历史/删除，顺序即展示顺序），`manage-cron-jobs.tsx` 新增 `renderActions` 统一渲染，两处重复分支收敛。

## Consequences
- 决策/映射/状态机规则全部可单测（测试 100 → 133），组件层只留副作用编排
- 「统一后台样式」改动收敛到 AdminListPage / action-buttons 两处，不再六处扩散
- 设置页密钥查看规则单一来源（reducer），settings 与 dialog 不再各写一套倒计时
- cron 动作可见性桌面/移动不再分叉；新增动作只需扩 availableActions + renderActions 的 case

## Alternatives considered
- C6 骨架做成继承式（AdminListPage 基类强制列结构）：被否（六页列差异大，会退化成浅包装；组合插槽保留差异自由度）
- C7 全拆 8 个分区：被否（site/social/footer/about/giscus/advanced 无独立变化理由，拆分只是搬移；只拆有独立交互的 cron 分区）
- C8 动作集合留在渲染（已判 Speculative）：验证后仍做——桌面/移动两处重复分支确实会再分叉，且决策无法单测
