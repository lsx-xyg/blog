# ADR 0019：视频封面（VIDEO_POSTER）的孤儿处理策略

- 状态：Implemented（2026-10-03）
- 关联：S2 视频 API 层 / S3 视频相册后台 / Phase 4 Step C3
- 实现：`lib/videos/server/orphans.ts` + `app/api/admin/media/orphans/route.ts` +
  manage-videos「清理孤儿封面」入口（Phase 4 Step C3，已随 C3 提交落地）

## 背景

视频封面通过 `media` 表管理（`videos.posterMediaId → media.id`，类型 `VIDEO_POSTER`），
复用现有图片上传链路。为防封面混入图片 Tab 与 media-picker，S2 约定：

- `listMedia` / `countMedia` 未传 type 时**显式排除** `VIDEO_POSTER`；
- `findUnusedMedia` **排除** `VIDEO_POSTER`（兜底，不承担回收职责）；
- 视频删除时封面联动删除（`isMediaReferenced` 检查，未被引用才删）。

## 问题

`findUnusedMedia` 排除 `VIDEO_POSTER` 之后，出现一类**永久孤儿**：

- 用户在视频编辑弹窗上传新封面（或上传后取消保存），`media` 表留下 `VIDEO_POSTER`
  记录与存储文件，但视频并未引用它（`posterMediaId` 仍指向旧封面或为 null）；
- 这类记录不会出现在图片 Tab（排除）、不会被 media-picker 选走（排除）、
  也不会被「未使用图片清理」回收（排除）——**永久占用存储**。

这是 S2 隔离设计的可接受代价：隔离正确性优先于自动回收。S3 Step B1 起
编辑器不再级联删除封面（替换/清除旧封面不立即删，交给清理流程），
使孤儿来源更多样化。

## 决策

1. **接受孤儿存在**：编辑/替换/清除封面均不级联删除旧封面或未引用封面；
2. **Phase 4 提供「孤儿封面清理」入口**（后台手动触发）：
   - 扫描所有 `VIDEO_POSTER` 且未被任何 `videos.posterMediaId` 引用的 media 记录；
   - 二次确认 `isMediaReferenced`（文章内容未引用该 url）后才删除记录 + 存储文件；
   - 仅在后台手动触发，不做自动清理。
3. 清理逻辑**不在** S3 阶段实现，仅记录行为与计划。

## 影响

- 存储成本：孤儿封面占用对象存储空间，需生命周期/bucket 策略兜底；
- 该 ADR 是 S3 Phase 4 的验收依据之一（“孤儿封面清理入口”）。
