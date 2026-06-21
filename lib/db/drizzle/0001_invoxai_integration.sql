ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_sync_status" text;

UPDATE "customers"
SET "external_source" = COALESCE("external_source", "external_system")
WHERE "external_system" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_external_source_external_id_uidx"
  ON "customers" ("external_source", "external_id")
  WHERE "external_source" IS NOT NULL AND "external_id" IS NOT NULL;

ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_sync_status" text;

CREATE UNIQUE INDEX IF NOT EXISTS "sites_external_source_external_id_uidx"
  ON "sites" ("external_source", "external_id")
  WHERE "external_source" IS NOT NULL AND "external_id" IS NOT NULL;

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_sync_status" text;

CREATE UNIQUE INDEX IF NOT EXISTS "services_external_source_external_id_uidx"
  ON "services" ("external_source", "external_id")
  WHERE "external_source" IS NOT NULL AND "external_id" IS NOT NULL;

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_sync_status" text;

CREATE UNIQUE INDEX IF NOT EXISTS "tickets_external_source_external_id_uidx"
  ON "tickets" ("external_source", "external_id")
  WHERE "external_source" IS NOT NULL AND "external_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "integration_idempotency_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "integration_source" text NOT NULL,
  "resource_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "status_code" integer NOT NULL,
  "resource_id" uuid,
  "response_body" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_idempotency_source_key_resource_uidx"
  ON "integration_idempotency_keys" ("integration_source", "idempotency_key", "resource_type");
