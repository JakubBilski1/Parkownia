CREATE TYPE "public"."email_suppression_reason" AS ENUM('UNSUBSCRIBED', 'COMPLAINT', 'MANUAL');--> statement-breakpoint
CREATE TABLE "email_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"reason" "email_suppression_reason" DEFAULT 'UNSUBSCRIBED' NOT NULL,
	"campaign_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_campaign_recipients" ADD COLUMN "unsubscribe_token_hash" text;--> statement-breakpoint
ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaign_recipients_unsub_key" ON "email_campaign_recipients" USING btree ("unsubscribe_token_hash");