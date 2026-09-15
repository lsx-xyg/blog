-- 1. 创建枚举类型（PostgreSQL 不支持 CREATE TYPE IF NOT EXISTS，用 DO 块）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backup_trigger') THEN
    CREATE TYPE "public"."backup_trigger" AS ENUM('MANUAL', 'AUTO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
    CREATE TYPE "public"."post_status" AS ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED');
  END IF;
END$$;
--> statement-breakpoint
-- 2. 创建所有表（IF NOT EXISTS）
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_key" text NOT NULL,
	"size" bigint NOT NULL,
	"triggered_by" "backup_trigger" DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friend_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"avatar_url" text,
	"description" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gallery_item_tags" (
	"gallery_item_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "gallery_item_tags_gallery_item_id_tag_id_pk" PRIMARY KEY("gallery_item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"image_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text,
	"title" text NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"cover_url" text,
	"status" "post_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"featured" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- 3. 添加外键约束（用 DO 块捕获 duplicate_object 异常）
DO $$
BEGIN
  -- account -> user
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_userId_user_id_fk') THEN
    ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  -- gallery_item_tags -> gallery_items
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_item_tags_gallery_item_id_gallery_items_id_fk') THEN
    ALTER TABLE "gallery_item_tags" ADD CONSTRAINT "gallery_item_tags_gallery_item_id_gallery_items_id_fk" FOREIGN KEY ("gallery_item_id") REFERENCES "public"."gallery_items"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  -- gallery_item_tags -> tags
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_item_tags_tag_id_tags_id_fk') THEN
    ALTER TABLE "gallery_item_tags" ADD CONSTRAINT "gallery_item_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  -- post_tags -> posts
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_tags_post_id_posts_id_fk') THEN
    ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  -- post_tags -> tags
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_tags_tag_id_tags_id_fk') THEN
    ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  -- session -> user
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_userId_user_id_fk') THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END$$;
--> statement-breakpoint
-- 4. 创建索引（IF NOT EXISTS）
CREATE INDEX IF NOT EXISTS "friend_links_sort_idx" ON "friend_links" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gallery_item_tags_tag_id_idx" ON "gallery_item_tags" USING btree ("tag_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gallery_items_featured_idx" ON "gallery_items" USING btree ("featured");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_tags_tag_id_idx" ON "post_tags" USING btree ("tag_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_status_idx" ON "posts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_scheduled_at_idx" ON "posts" USING btree ("scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_featured_idx" ON "posts" USING btree ("featured");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_idx" ON "tags" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_idx" ON "tags" USING btree ("slug");
