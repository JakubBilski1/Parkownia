ALTER TABLE "driver_signups" ADD COLUMN "privacy_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_signups" ADD COLUMN "privacy_consent_version" text;