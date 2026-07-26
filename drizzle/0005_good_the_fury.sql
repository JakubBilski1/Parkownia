CREATE TYPE "public"."campaign_consent" AS ENUM('GRANTED', 'MISSING', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."campaign_recipient_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "email_campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"email" "citext" NOT NULL,
	"name" text,
	"consent" "campaign_consent" NOT NULL,
	"status" "campaign_recipient_status" DEFAULT 'PENDING' NOT NULL,
	"error" text,
	"provider_ref" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_campaign_recipients_unique" UNIQUE("campaign_id","email")
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"preheader" text,
	"heading" text NOT NULL,
	"paragraphs" jsonb NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"created_by" uuid,
	"consent_override" boolean DEFAULT false NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_campaign_recipients_campaign_idx" ON "email_campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "email_campaign_recipients_email_idx" ON "email_campaign_recipients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_campaigns_created_at_idx" ON "email_campaigns" USING btree ("created_at");