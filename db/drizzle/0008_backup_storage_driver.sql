-- 给 backup_records 表添加 storage_driver 字段
-- 用于记录备份创建时使用的存储驱动，切换驱动后仍能正确操作旧备份
ALTER TABLE "backup_records" ADD COLUMN IF NOT EXISTS "storage_driver" "storage_driver";
--> statement-breakpoint
-- 给新字段添加索引，方便按驱动筛选
CREATE INDEX IF NOT EXISTS "backup_records_storage_driver_idx" ON "backup_records" ("storage_driver");
