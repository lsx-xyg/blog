# AGENTS.md

## 文档导航（Docs Map）

本项目所有决策与规格文档都在仓库内，按用途分层。改代码前先读相关文档：

| 文档                            | 作用                                                                                                                              | 何时更新                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `docs/SPEC.md`                  | **功能规格 v1.0（已冻结）**：数据库 18 表（14 业务 + 4 认证）、存储抽象、认证引导、客户端搜索、定时发布、备份、SEO 等全部需求决策 | 需求变更走 grilling / to-spec 流程，不直接改 |
| `PRODUCT.md`                    | 产品记录（impeccable init）：用户/定位/运行上下文/原则                                                                            | 产品事实变化时                               |
| `DESIGN.md`                     | **视觉设计规范（已锁定）**：三主题 tokens、字体、布局、组件、动效、与参考站关系                                                   | 设计决策变更时                               |
| `docs/adr/0001-0016`            | 架构决策记录：部署/ORM/存储抽象→存储档案池/客户端筛选/认证入口/定时备份/引导系统/深模块化重构/部署期迁移                          | 新架构决策追加 0017+                         |
| `docs/agents/skill-workflow.md` | **技能调用流程**：阶段→技能映射、当前进度、里程碑清单（含勾选状态）                                                               | 每个里程碑完成时打勾                         |
| `docs/agents/issue-tracker.md`  | GitHub issue 工作流（gh CLI）                                                                                                     | 流程变更时                                   |
| `docs/agents/triage-labels.md`  | triage 默认标签词汇                                                                                                               | 标签变更时                                   |
| `docs/agents/domain.md`         | 领域文档消费规则（single-context）                                                                                                | 规则变更时                                   |

**ADR 现状提示**：`0008`（存储公私分离）已被 `0015`（存储档案池 + 通道绑定）取代，读存储相关决策请以 0015 + `CONTEXT.md` 存储领域词条为准；0003/0007/0009 正文里的文件路径是当时版本（`lib/` 重构后已迁移），追代码请用仓内实际路径。

**工作顺序纪律**：设计文档（DESIGN.md）在实现（taste-skill）之前；spec/tickets 在实现之前；ADR 记录关键架构决策。

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (gh CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
