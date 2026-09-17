# ADR-0014: 架构深化第三轮（C9–C12）——API 路由薄壳 / 文章编辑链路 / Cron 表单交互 / 媒体上传收口

- Status: **Accepted**
- Date: 2026-09-17

## Context
ADR-0013 完成 C5–C8 后，第三轮评审（improve-codebase-architecture）沿「交互链路收口 + 服务层薄壳」继续深挖四个候选：

1. **C9（Strong）**：API 路由层偏厚——`settings/route.ts` 297 行（读写合并、敏感字段裁剪、加密/删除逻辑内联），guides 三条路由（route / [id] / progress）合计 300+ 行（校验、DB 访问、错误分支全内联），`requireAdmin` 鉴权守卫每路由重复 6 行。路由层既无测试入口也无法单测。
2. **C10（Worth exploring）**：post-editor 407 行 + markdown-editor 447 行，表单状态（编辑回填、步骤机、标签加载、保存编排）与 shiki 高亮初始化（重复 createHighlighter 两次、theme 判断内联）、markdown 中文 locale 定义全部内联组件。
3. **C11（Worth exploring）**：manage-cron-jobs 1178 行，表单交互（创建/编辑切换、详情回填 66 行、保存编排）与表单弹窗 JSX（约 470 行）全部内联。
4. **C12（Speculative）**：manage-media 812 行，上传状态（uploading/uploadType/uploadOpen/uploadFiles）、选择/移除/上传函数与上传弹窗内联；media-picker 另有一份重复的 fetch /api/admin/media 上传循环。

## Decision
- **C9 路由层 service 化**：新增 `lib/shared/admin-api.ts`（`requireAdmin` 鉴权守卫 + `apiError` 统一错误响应）；新增 `lib/settings/service.ts`（`getSettingsBundle` 聚合读取 + 敏感字段 only-configured 裁剪、`buildSettingsOps`/`applySettingsPatch` 三分支：普通字段原样存 / 敏感字段空串删除 + 值加密 / 可选文本空串删除，加密函数可注入测试，`toStorageForClient`/`toCronForClient` 纯裁剪）；新增 `lib/guide/service.ts`（`parseGuideInput`/`parseGuidePatch`/`parseProgressInput`/`validatePublishedSteps` 纯校验 + `listGuides`/`createGuide`/`updateGuide`/`deleteGuideById`/`getProgress`/`upsertProgress`/`deleteProgress` db 封装，写操作返回 `GuideWriteResult`/`GuideDeleteResult` 联合）。settings/route.ts 297 → 58，guides 三路由合计减 ~180 行。25 新单测。
- **C10 文章编辑链路**：新增 `lib/posts/form.ts`（`PostFormData`/`emptyForm`/`EDITOR_STEPS`/`validatePostForm`/`buildPostPayload` 纯函数，含「编辑时内容留空不传 content」、scheduledAt 空串→null）、`components/post/use-post-form.ts`（表单状态机 hook：表单/步骤机/标签加载/保存编排/toast/跳转）、`lib/mdx/shiki.ts`（`createShikiHighlighter`/`createShikiRehypePlugin`/`getEffectiveTheme` 工厂，消灭双实例）+ `lib/mdx/locale.ts`（markdown 中文文案收敛）。post-editor 407 → 279，markdown-editor 447 → 276。7 新单测。
- **C11 定时任务页交互拆分**：新增 `components/cron/use-cron-form.ts`（创建/编辑切换、详情回填（兼容仅 jobId/title 的系统任务）、保存编排，保存成功经 `onSaved` 通知父组件刷新）、`components/cron/cron-job-form-dialog.tsx`（表单弹窗纯展示组件，通知折叠 UI 状态组件内自持）。manage-cron-jobs 1178 → 620。
  - **system-jobs-panel 验证后不成立**：评审原计划抽系统任务预设面板，但系统任务无独立 UI（系统标签即行内展示，无预设编辑入口），跳过并在 commit message 说明。
- **C12 媒体上传流程收口**：新增 `lib/media/upload.ts`（`validateUploadTarget` 纯校验、`uploadMediaFile`/`uploadMediaFiles` 共享上传执行：fetch + 错误归一化 + 批量汇总）、`components/media/use-media-upload.ts`（上传弹窗开关/目标/暂存文件/批量编排状态机）、`components/media/upload-dialog.tsx`（弹窗纯展示：类型单选 + 文件列表）。manage-media 812 → 685；media-picker 重复上传循环改用 `uploadMediaFile`。6 新单测。

## Consequences
- API 路由全部变薄壳（鉴权 + 校验 + 调 service），读写规则集中在 service 层可单测（测试 133 → 171）
- 文章编辑表单/保存决策单一来源（use-post-form），shiki 单例工厂避免双初始化；编辑器组件只留渲染
- cron 表单交互（含详情回填）与 JSX 分离，后续改表单只动 dialog 组件
- 媒体上传执行两处共用一份（manage-media 弹窗 / media-picker），错误处理口径统一

## Alternatives considered
- C9 守卫做成装饰器/高阶包路由：被否（Next.js App Router handler 签名不统一，守卫包一层反而遮蔽类型；显式守卫 + apiError 更直白）
- C9 校验留在路由（只拆 DB）：被否（校验与 DB 访问同属「输入 → 落库」契约，拆开会两头维护；parse* 纯函数使校验可测）
- C10 markdown-editor 只拆 shiki（locale 留在组件）：被否（locale 对象 55 行与主题切换同属编辑器配置，一并收敛）
- C11 弹窗用受控 props 传全部表单字段：被否（表单字段 20+，逐字段传参退化成中继；setForm 整体传引用更贴近 useCronForm 状态机）
- C12 上传弹窗留在 manage-media（只抽 hook）：被否（弹窗 100+ 行含文件列表/目标切换，抽成纯展示组件后 manage-media 只剩编排，与 C11 模式一致）
