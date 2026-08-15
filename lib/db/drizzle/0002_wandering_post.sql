ALTER TABLE "managed_devices" ADD COLUMN "public_label" text;--> statement-breakpoint
ALTER TABLE "managed_devices" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;