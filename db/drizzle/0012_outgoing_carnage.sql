DO $$
BEGIN
  -- 仅当 WEBDAV 不存在时，才新增枚举值
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'storage_driver')
      AND enumlabel = 'WEBDAV'
  ) THEN
    ALTER TYPE "public"."storage_driver" ADD VALUE 'WEBDAV';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storage_profiles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "driver" "storage_driver" NOT NULL,
    "config" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "storage_profiles_name_unique" UNIQUE("name")
);
