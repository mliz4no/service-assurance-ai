CREATE TABLE IF NOT EXISTS "avalara_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector" text NOT NULL,
	"sync_type" text DEFAULT 'full' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"message" text,
	"records_processed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'noc' NOT NULL,
	"notify_on_severity" text DEFAULT 'high' NOT NULL,
	"notify_on_duration_minutes" integer,
	"notification_channels" text DEFAULT 'email' NOT NULL,
	"external_system" text,
	"external_id" text,
	"external_synced_at" timestamp with time zone,
	"external_sync_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "escalation_matrix_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid,
	"impact_level" text NOT NULL,
	"urgency_level" text NOT NULL,
	"derived_severity" text NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_matrix_scope_cell" UNIQUE("scope_type", "scope_id", "impact_level", "urgency_level")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "escalation_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"contact_id" uuid,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_role" text NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"severity" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"reason" text NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'simulated' NOT NULL,
	"rule_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telecom_services_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salesforce_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"complaint_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid,
	"service_id" uuid,
	"assigned_to_user_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"complaint_type" text DEFAULT 'other' NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_account_number" text NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"invoice_amount" numeric(12, 2),
	"document_code" text,
	"company_code" text,
	"avalara_validation_status" text DEFAULT 'not_validated' NOT NULL,
	"avalara_validated_at" timestamp with time zone,
	"avalara_summary" text,
	"external_source" text,
	"external_id" text,
	"external_synced_at" timestamp with time zone,
	"external_sync_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_complaints_complaint_number_unique" UNIQUE("complaint_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_complaint_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"complaint_id" uuid NOT NULL,
	"event_type" text DEFAULT 'note' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitored_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"public_label" text,
	"host_or_ip" text NOT NULL,
	"customer_id" uuid,
	"site_id" uuid,
	"service_id" uuid,
	"target_type" text DEFAULT 'ip' NOT NULL,
	"provider" text,
	"region" text,
	"latitude" double precision,
	"longitude" double precision,
	"status" text DEFAULT 'unknown' NOT NULL,
	"status_source" text DEFAULT 'manual' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitoring_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"check_type" text NOT NULL,
	"status" text NOT NULL,
	"response_time_ms" integer,
	"payload_json" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "telecom_services_partner_id" uuid;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_system" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_sync_status" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "lcon_name" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "lcon_phone" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "lcon_email" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "longitude" double precision;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "geo_source" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "impact_level" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "urgency_level" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "external_sync_status" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "impact_level" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "external_sync_status" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "impact_level" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "urgency_level" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_source" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_synced_at" timestamp with time zone;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_sync_status" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telecom_services_partner_id" uuid;
ALTER TABLE "managed_devices" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "managed_devices" ADD COLUMN IF NOT EXISTS "longitude" double precision;
ALTER TABLE "managed_devices" ADD COLUMN IF NOT EXISTS "geo_source" text;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_contacts_customer_id_customers_id_fk') THEN
		ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escalation_matrix_overrides_updated_by_user_id_users_id_fk') THEN
		ALTER TABLE "escalation_matrix_overrides" ADD CONSTRAINT "escalation_matrix_overrides_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escalation_notifications_ticket_id_tickets_id_fk') THEN
		ALTER TABLE "escalation_notifications" ADD CONSTRAINT "escalation_notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE cascade;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escalation_notifications_contact_id_customer_contacts_id_fk') THEN
		ALTER TABLE "escalation_notifications" ADD CONSTRAINT "escalation_notifications_contact_id_customer_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_complaints_customer_id_customers_id_fk') THEN
		ALTER TABLE "invoice_complaints" ADD CONSTRAINT "invoice_complaints_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_complaints_site_id_sites_id_fk') THEN
		ALTER TABLE "invoice_complaints" ADD CONSTRAINT "invoice_complaints_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_complaints_service_id_services_id_fk') THEN
		ALTER TABLE "invoice_complaints" ADD CONSTRAINT "invoice_complaints_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_complaints_assigned_to_user_id_users_id_fk') THEN
		ALTER TABLE "invoice_complaints" ADD CONSTRAINT "invoice_complaints_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_complaint_events_complaint_id_invoice_complaints_id_fk') THEN
		ALTER TABLE "invoice_complaint_events" ADD CONSTRAINT "invoice_complaint_events_complaint_id_invoice_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "invoice_complaints"("id") ON DELETE cascade;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_complaint_events_created_by_user_id_users_id_fk') THEN
		ALTER TABLE "invoice_complaint_events" ADD CONSTRAINT "invoice_complaint_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitored_targets_customer_id_customers_id_fk') THEN
		ALTER TABLE "monitored_targets" ADD CONSTRAINT "monitored_targets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitored_targets_site_id_sites_id_fk') THEN
		ALTER TABLE "monitored_targets" ADD CONSTRAINT "monitored_targets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitored_targets_service_id_services_id_fk') THEN
		ALTER TABLE "monitored_targets" ADD CONSTRAINT "monitored_targets_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE set null;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitoring_checks_target_id_monitored_targets_id_fk') THEN
		ALTER TABLE "monitoring_checks" ADD CONSTRAINT "monitoring_checks_target_id_monitored_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "monitored_targets"("id") ON DELETE cascade;
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_idempotency_source_key_resource_uidx" ON "integration_idempotency_keys" ("integration_source", "idempotency_key", "resource_type");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_complaints_external_source_external_id_uidx" ON "invoice_complaints" ("external_source", "external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "monitored_targets_host_or_ip_uidx" ON "monitored_targets" ("host_or_ip");
CREATE UNIQUE INDEX IF NOT EXISTS "monitored_targets_public_label_uidx" ON "monitored_targets" ("public_label");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_external_source_external_id_uidx" ON "customers" ("external_source", "external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sites_external_source_external_id_uidx" ON "sites" ("external_source", "external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "services_external_source_external_id_uidx" ON "services" ("external_source", "external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_external_source_external_id_uidx" ON "tickets" ("external_source", "external_id");