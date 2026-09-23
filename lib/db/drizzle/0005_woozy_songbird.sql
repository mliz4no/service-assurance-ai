CREATE TABLE "dns_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_name" text NOT NULL,
	"address" text NOT NULL,
	"transport" text NOT NULL,
	"port" integer DEFAULT 53 NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"asn" text,
	"dnssec_supported" boolean,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_validated_at" timestamp with time zone,
	"validation_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_events" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_events" ADD COLUMN "compliance_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_events" ADD COLUMN "retention_category" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "preferred_check_type" text;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "check_port" integer;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "check_config" jsonb;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "ownership_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "ownership_method" text;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "ownership_verification_value" text;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "probe_allowlisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "monitored_targets" ADD COLUMN "probe_cadence_seconds" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "dns_candidates_address_transport_uidx" ON "dns_candidates" USING btree ("address","transport");