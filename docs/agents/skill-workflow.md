# 技能调用流程（Skill Workflow）

> 按项目阶段映射技能调用方式：**手动** = 人/Agent 主动触发；**自动** = 流程中随动作触发（hooks / 交付验证 / 提交钩子）。
> 技能来源：mattpocock/skills（工程流程）、impeccable（设计系统）、taste-skill（前端实现品味）。

## 技能来源速查

| 来源 | 安装 | 状态 |
|---|---|---|
| mattpocock/skills（to-spec/to-tickets/triage/tdd/code-review/git-commit 等） | 已装（`S2/`） | ✅ 已配置（AGENTS.md + docs/agents/） |
| impeccable（init/document/shape/critique/audit/polish） | 已装（`S2/impeccable`） | ✅ 已使用（init → PRODUCT.md / DESIGN.md 已锁定） |
| taste-skill（design-taste-frontend 等 13 个） | 已装（`S2/`，官方重拉） | ✅ 实现期写前端组件时套用（防 slop） |

## 阶段 → 技能映射

| 阶段 | 技能 | 调用方式 | 触发时机 |
|---|---|---|---|
| **规划 / 需求澄清** | grill-me / grilling | 手动 | 需求模糊时逐轮追问；本项目的 SPEC 已冻结 |
| | to-questionnaire | 手动 | 决策无法自行回答时 |
| **规格** | to-spec | 手动 | 需求明确 → 生成 spec 发布到 issue tracker |
| | to-tickets | 手动 | spec 确认 → 拆为 tracer-bullet tickets |
| | ADR（docs/adr/） | 手动 | 关键技术决策落档（已完成 0001-0006） |
| **设计（UI）** | impeccable `context` | 手动 | 每会话首次 |
| | impeccable `init` / `document` | 手动 | **锁定 PRODUCT.md / DESIGN.md**（✅ 已完成） |
| | impeccable `shape` | 手动 | 新界面规划 UX/UI 后再写代码 |
| | impeccable `critique` / `audit` | 手动 | 界面完成后的设计/技术评审 |
| **开发** | implement / implement-spec | 手动 | 按 ticket 实现 |
| | tdd | 手动 | 测试优先的功能 |
| | codebase-design / domain-modeling | 按需 | 模块设计 / 术语建模时 |
| | taste-skill（design-taste-frontend） | 手动 | **写前端组件时套用**（防 slop） |
| | setup-pre-commit | 一次性 | M1 配置 Husky + lint-staged + 类型检查 |
| **质量** | code-review | 手动 | 变更后按 diff 评审 |
| | diagnosing-bugs | 按需 | 疑难 bug / 性能回退 |
| | verifier-hub | 自动（交付前） | 确定性产物校验（文件/xlsx/docx/pdf 等） |
| | artifact-preview | 自动（交付前） | 产物渲染预览（pdf/pptx/html 等） |
| | impeccable `polish` | 手动 | 上线前最后打磨 |
| **提交** | git-commit | 自动 | 每次 commit（conventional message + 智能暂存） |
| | git-flow-branch-creator | 手动 | 创建分支时 |
| **部署 / 运维** | 定时发布/备份（cron） | 自动 | Vercel 模式 cron-job.org / SERVER 模式 node-cron |
| | triage / wayfinder | 按需 | issue 流转 / 路径规划 |
| **交接** | handoff | 手动 | 会话压缩交接给其他 Agent |

## 本项目阶段当前进度（2026-09-10）

| 阶段 | 状态 |
|---|---|
| 规划 / 需求澄清 | ✅ 完成（SPEC v1.0 冻结，docs/SPEC.md） |
| 规格 | ✅ 完成（SPEC + ADR 0001-0006） |
| 工程配置 | ✅ 完成（AGENTS.md + docs/agents/；技能三源重装；GitHub 仓库 blog + images 图床） |
| 设计（UI） | ✅ 完成（PRODUCT.md + DESIGN.md 锁定：参考站结构 × 现代 UI 升级，4 项决策已确认） |
| 开发 | 🚧 **进行中（M1 脚手架开始）** |
| 部署 / 运维 | ⏳ M6 |

## 下一步行动（按顺序）

| 里程碑 | 做什么 | 调用什么 skill | 状态 |
|---|---|---|---|
| **M1 脚手架** | Next.js 15 + TS + Tailwind + Drizzle 初始化；git 关联 blog 仓库 | setup-pre-commit（一次性）、git-commit | ✅ 已完成（2026-09-10，构建通过，已推送） |
| **M2 数据层** | Drizzle schema 9 张表 + 迁移 + seed | domain-modeling（如需建模）、implement | 🚧 进行中：**T1 schema+迁移 ✅**（2026-09-11，12 表落库验证通过），seed 待做 |
| **M3 前台** | 首页（瀑布流+筛选）、相册、文章页（MDX+Shiki）、关于/友链、三主题 | **taste-skill（design-taste-frontend）**、impeccable `craft`/`audit` | 🚧 进行中：**T4 文章闭环 ✅**（2026-09-11，列表+详情+MDX+Shiki+浏览量 e2e 通过），瀑布流/筛选待 T7 |
| **M4 后台** | Better Auth（密码+GitHub+关联）、引导流程、Milkdown 编辑器、管理 CRUD | implement、impeccable `operate` 相关 | ⏳ 待开始 |
| **M5 存储/搜索/评论** | StorageDriver（VERCEL_BLOB/S3/GITHUB+jsDelivr）、minisearch、giscus | implement、tdd | ⏳ 待开始 |
| **M6 定时/备份/SEO** | 定时发布两套实现、JSON 备份+导入、SEO/OG | implement、code-review | ⏳ 待开始 |
| **质量收口** | 全量评审、bug 修复、上线前打磨 | tdd、code-review、diagnosing-bugs、verifier-hub、artifact-preview、impeccable `polish` | ⏳ 待开始 |

## 使用原则
- **手动技能不自动跑**：grilling / to-spec / to-tickets / impeccable / code-review / implement 等，必须在对应阶段由用户或 Agent 显式调用，不得跳过阶段
- **自动技能不手动补**：git-commit、verifier-hub、artifact-preview 在流程内自动触发，不需要也不应该人工重复执行
- **顺序纪律**：设计文档（impeccable）在实现（taste-skill）之前；spec/tickets 在实现之前
