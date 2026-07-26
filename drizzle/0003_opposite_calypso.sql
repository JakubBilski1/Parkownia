CREATE TYPE "public"."lead_contact_preference" AS ENUM('PHONE', 'EMAIL');--> statement-breakpoint
CREATE TYPE "public"."lead_object_type" AS ENUM('LOT', 'DRIVEWAY', 'COMPANY_LOT', 'GARAGE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"object_name" text,
	"address" text NOT NULL,
	"location" geography(Point,4326),
	"object_type" "lead_object_type",
	"spots_declared" integer,
	"contact_name" text NOT NULL,
	"phone" text,
	"email" "citext",
	"contact_preference" "lead_contact_preference" NOT NULL,
	"estimated_rate_gr" integer,
	"estimated_annual_gross_gr" integer,
	"events_in_reach" integer,
	"walk_minutes_enea" integer,
	"walk_minutes_mtp" integer,
	"privacy_consent" boolean DEFAULT false NOT NULL,
	"privacy_consent_version" text,
	"marketing_email_consent" boolean DEFAULT false NOT NULL,
	"marketing_phone_consent" boolean DEFAULT false NOT NULL,
	"source" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_contact_present" CHECK ("leads"."phone" is not null or "leads"."email" is not null)
);
--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_location_gist_idx" ON "leads" USING gist ("location");