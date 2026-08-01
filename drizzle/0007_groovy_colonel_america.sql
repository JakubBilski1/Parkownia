CREATE TABLE "driver_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"parking_id" uuid,
	"event_id" uuid,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_signups_email_event_unique" UNIQUE("email","event_id")
);
--> statement-breakpoint
ALTER TABLE "driver_signups" ADD CONSTRAINT "driver_signups_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_signups" ADD CONSTRAINT "driver_signups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_signups_event_idx" ON "driver_signups" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "driver_signups_created_at_idx" ON "driver_signups" USING btree ("created_at");