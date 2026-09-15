-- 创建 storage_driver 枚举类型
-- PostgreSQL 不支持 CREATE TYPE IF NOT EXISTS，用 DO 块检查是否存在
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'storage_driver') THEN
    CREATE TYPE "storage_driver" AS ENUM ('LOCAL', 'GITHUB', 'S3');
  END IF;
END$$;

ALTER TABLE "media" ALTER COLUMN "storage_driver" DROP DEFAULT;

ALTER TABLE "media" ALTER COLUMN "storage_driver" TYPE "storage_driver" USING "storage_driver"::"storage_driver";

ALTER TABLE "media" ALTER COLUMN "storage_driver" SET DEFAULT 'LOCAL'::"storage_driver";
