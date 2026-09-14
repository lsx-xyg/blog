CREATE TYPE IF NOT EXISTS "storage_driver" AS ENUM ('LOCAL', 'GITHUB', 'S3');

ALTER TABLE "media" ALTER COLUMN "storage_driver" DROP DEFAULT;

ALTER TABLE "media" ALTER COLUMN "storage_driver" TYPE "storage_driver" USING "storage_driver"::"storage_driver";

ALTER TABLE "media" ALTER COLUMN "storage_driver" SET DEFAULT 'LOCAL'::"storage_driver";
