-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('APPROVED', 'UNAPPROVED', 'UPDATED', 'CREATED');

-- CreateTable
CREATE TABLE "review_audit_logs" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "action" "audit_action" NOT NULL,
    "user_id" TEXT,
    "previous_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_audit_logs_review_id_idx" ON "review_audit_logs"("review_id");

-- CreateIndex
CREATE INDEX "review_audit_logs_action_idx" ON "review_audit_logs"("action");

-- CreateIndex
CREATE INDEX "review_audit_logs_user_id_idx" ON "review_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "review_audit_logs_timestamp_idx" ON "review_audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "review_audit_logs" ADD CONSTRAINT "review_audit_logs_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
