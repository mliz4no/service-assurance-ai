CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'ops' NOT NULL,
	"customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"account_number" text,
	"status" text DEFAULT 'active' NOT NULL,
	"primary_contact_name" text,
	"primary_contact_email" text,
	"primary_contact_phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_name" text NOT NULL,
	"address1" text,
	"address2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"timezone" text,
	"site_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"vendor_name" text NOT NULL,
	"service_type" text NOT NULL,
	"circuit_id" text,
	"bandwidth" text,
	"status" text DEFAULT 'active' NOT NULL,
	"install_date" text,
	"monthly_recurring_charge" numeric(10, 2),
	"support_reference" text,
	"notes" text,
	"primary_managed_device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"severity" text NOT NULL,
	"initial_response_minutes" integer NOT NULL,
	"escalation_minutes" integer NOT NULL,
	"resolution_target_minutes" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid,
	"service_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"outage_type" text DEFAULT 'unknown' NOT NULL,
	"vendor_ticket_id" text,
	"assigned_to_user_id" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"next_escalation_at" timestamp with time zone,
	"sla_target_minutes" integer,
	"ai_summary" text,
	"ai_normalized_status" text,
	"ai_customer_update" text,
	"ai_last_generated_at" timestamp with time zone,
	"ai_summarized_at" timestamp with time zone,
	"ai_normalized_at" timestamp with time zone,
	"ai_customer_update_at" timestamp with time zone,
	"ai_confidence" integer,
	"ai_probable_impact" text,
	"incident_source" text DEFAULT 'manual',
	"impacted_device_id" uuid,
	"impacted_link_id" uuid,
	"failover_active" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "ticket_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"update_type" text NOT NULL,
	"raw_text" text NOT NULL,
	"normalized_status" text,
	"ai_source_text" text,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "controllers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vendor" text NOT NULL,
	"type" text NOT NULL,
	"base_url" text NOT NULL,
	"auth_type" text DEFAULT 'api_key' NOT NULL,
	"api_key_encrypted_or_placeholder" text,
	"organization_id_or_tenant" text,
	"polling_enabled" boolean DEFAULT false NOT NULL,
	"polling_interval_seconds" integer DEFAULT 300 NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_poll_status" text,
	"last_poll_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "managed_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_id" uuid NOT NULL,
	"customer_id" uuid,
	"site_id" uuid,
	"hostname" text NOT NULL,
	"device_type" text NOT NULL,
	"vendor" text NOT NULL,
	"serial_number" text,
	"controller_device_id" text NOT NULL,
	"model" text,
	"mgmt_ip" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"ha_state" text,
	"network_name" text,
	"last_seen_at" timestamp with time zone,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"managed_device_id" uuid NOT NULL,
	"service_id" uuid,
	"customer_id" uuid,
	"site_id" uuid,
	"link_name" text NOT NULL,
	"link_type" text NOT NULL,
	"provider_name" text,
	"circuit_id" text,
	"role" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"latency_ms" real,
	"jitter_ms" real,
	"packet_loss_pct" real,
	"failover_active" boolean DEFAULT false NOT NULL,
	"network_name" text,
	"last_polled_at" timestamp with time zone,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_id" uuid NOT NULL,
	"managed_device_id" uuid,
	"customer_id" uuid,
	"site_id" uuid,
	"service_id" uuid,
	"raw_event_id" text NOT NULL,
	"event_source" text NOT NULL,
	"severity" text DEFAULT 'informational' NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"normalized_status" text,
	"ai_summary" text,
	"ai_probable_impact" text,
	"ai_customer_update" text,
	"confidence_score" integer,
	"category" text,
	"raw_payload_json" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "controller_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_id" uuid NOT NULL,
	"sync_type" text DEFAULT 'full' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"message" text,
	"records_processed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_correlations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"device_event_id" uuid NOT NULL,
	"correlation_type" text DEFAULT 'trigger' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_updates" ADD CONSTRAINT "ticket_updates_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_updates" ADD CONSTRAINT "ticket_updates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_devices" ADD CONSTRAINT "managed_devices_controller_id_controllers_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controllers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_devices" ADD CONSTRAINT "managed_devices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_devices" ADD CONSTRAINT "managed_devices_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_links" ADD CONSTRAINT "network_links_managed_device_id_managed_devices_id_fk" FOREIGN KEY ("managed_device_id") REFERENCES "public"."managed_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_links" ADD CONSTRAINT "network_links_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_links" ADD CONSTRAINT "network_links_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_links" ADD CONSTRAINT "network_links_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_controller_id_controllers_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controllers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_managed_device_id_managed_devices_id_fk" FOREIGN KEY ("managed_device_id") REFERENCES "public"."managed_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controller_sync_logs" ADD CONSTRAINT "controller_sync_logs_controller_id_controllers_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."controllers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_correlations" ADD CONSTRAINT "incident_correlations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_correlations" ADD CONSTRAINT "incident_correlations_device_event_id_device_events_id_fk" FOREIGN KEY ("device_event_id") REFERENCES "public"."device_events"("id") ON DELETE cascade ON UPDATE no action;