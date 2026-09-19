-- 创建备份审计操作枚举
-- PostgreSQL 不支持 CREATE TYPE IF NOT EXISTS，用 DO 块检查是否存在
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backup_audit_action') THEN
    CREATE TYPE "backup_audit_action" AS ENUM ('CREATE', 'DOWNLOAD', 'DELETE', 'RESTORE');
  END IF;
END$$;
--> statement-breakpoint
-- 创建备份审计日志表
CREATE TABLE IF NOT EXISTS "backup_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backup_id" uuid,
	"file_key" text NOT NULL,
	"action" "backup_audit_action" NOT NULL,
	"user_id" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backup_audit_backup_idx" ON "backup_audit_logs" ("backup_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backup_audit_action_idx" ON "backup_audit_logs" ("action");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backup_audit_created_at_idx" ON "backup_audit_logs" ("created_at");
