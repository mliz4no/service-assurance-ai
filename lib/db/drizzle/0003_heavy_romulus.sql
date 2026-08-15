CREATE TABLE "provider_lookups" (
	"ip_address" text PRIMARY KEY NOT NULL,
	"provider" text,
	"region" text,
	"asn" text,
	"country" text,
	"city" text,
	"source" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
