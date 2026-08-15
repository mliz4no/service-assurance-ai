ALTER TABLE "managed_devices" ADD COLUMN IF NOT EXISTS "public_label" text;--> statement-breakpoint
ALTER TABLE "managed_devices" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;