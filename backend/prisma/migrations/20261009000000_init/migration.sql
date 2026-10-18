-- Initial TiluchiRecords schema for the modular 3-layer MVP.

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "MediaAssetOrigin" AS ENUM ('UPLOADED', 'GENERATED');
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED');
CREATE TYPE "MediaAssetKind" AS ENUM (
  'ORIGINAL_AUDIO',
  'INSTRUMENTAL_STEM',
  'VOCAL_STEM',
  'RECORDED_TAKE',
  'FINAL_MIX',
  'FACE_SWAP_SOURCE_IMAGE',
  'FACE_SWAP_SOURCE_VIDEO',
  'FACE_SWAP_RESULT_VIDEO',
  'VIDEO_CLIP',
  'FINAL_VIDEOCLIP'
);
CREATE TYPE "JobType" AS ENUM (
  'AUDIO_SEPARATION',
  'GENERATE_FINAL_MIX',
  'FACE_SWAP',
  'ANALYZE_AUDIO',
  'GENERATE_STORYBOARD',
  'GENERATE_VIDEO_CLIPS',
  'COMPOSE_VIDEOCLIP'
);
CREATE TYPE "JobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'WAITING_USER',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_assets" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "origin" "MediaAssetOrigin" NOT NULL,
  "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADING',
  "kind" "MediaAssetKind" NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" BIGINT,
  "duration_seconds" DOUBLE PRECISION,
  "storage_key" TEXT NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processing_jobs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "type" "JobType" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "payload" JSONB DEFAULT '{}',
  "result" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_stages" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "job_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consent_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "terms_accepted" BOOLEAN NOT NULL,
  "consent_text" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");
CREATE INDEX "media_assets_project_id_idx" ON "media_assets"("project_id");
CREATE INDEX "media_assets_status_idx" ON "media_assets"("status");
CREATE INDEX "media_assets_kind_idx" ON "media_assets"("kind");
CREATE INDEX "processing_jobs_project_id_idx" ON "processing_jobs"("project_id");
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");
CREATE INDEX "job_stages_job_id_idx" ON "job_stages"("job_id");
CREATE INDEX "consent_logs_user_id_idx" ON "consent_logs"("user_id");
CREATE INDEX "consent_logs_project_id_idx" ON "consent_logs"("project_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "processing_jobs"
  ADD CONSTRAINT "processing_jobs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_stages"
  ADD CONSTRAINT "job_stages_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "processing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent_logs"
  ADD CONSTRAINT "consent_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
