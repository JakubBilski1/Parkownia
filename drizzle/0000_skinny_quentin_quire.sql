CREATE TYPE "public"."access_type" AS ENUM('OPEN', 'BARRIER_CODE', 'BARRIER_REMOTE', 'GATE_MANUAL', 'LPR', 'KEY_HANDOVER', 'ATTENDANT');--> statement-breakpoint
CREATE TYPE "public"."action_token_purpose" AS ENUM('EVENT_AVAILABILITY', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'DATA_EXPORT');--> statement-breakpoint
CREATE TYPE "public"."availability_mode" AS ENUM('ALWAYS', 'RECURRING_SCHEDULE', 'EVENT_ONLY', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'USED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."commission_scope" AS ENUM('GLOBAL_INDIVIDUAL', 'GLOBAL_BUSINESS', 'USER', 'PARKING');--> statement-breakpoint
CREATE TYPE "public"."consent_kind" AS ENUM('TERMS', 'PRIVACY', 'MARKETING_EMAIL', 'MARKETING_SMS');--> statement-breakpoint
CREATE TYPE "public"."ev_connector_type" AS ENUM('TYPE2', 'CCS', 'CHADEMO', 'SCHUKO');--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('FOOTBALL', 'CONCERT', 'TRADE_FAIR', 'SPORTS', 'FESTIVAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('INDIVIDUAL', 'BUSINESS');--> statement-breakpoint
CREATE TYPE "public"."parking_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."parking_type" AS ENUM('OUTDOOR_LOT', 'UNDERGROUND', 'GARAGE', 'DRIVEWAY', 'STREET_ADJACENT', 'MULTI_STOREY');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('BLIK', 'CARD');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('MANUAL', 'STRIPE', 'P24', 'AUTOPAY');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('INITIATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'PAID', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('DRIVER', 'HOST_INDIVIDUAL', 'HOST_BUSINESS', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('ADMITTED', 'REJECTED_USED', 'REJECTED_INVALID', 'REJECTED_TIME');--> statement-breakpoint
CREATE TYPE "public"."surface" AS ENUM('ASPHALT', 'PAVING', 'CONCRETE', 'GRAVEL', 'GRASS', 'DIRT');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('CAR', 'SUV', 'VAN', 'MOTORCYCLE', 'CAMPER', 'TRAILER', 'BICYCLE');--> statement-breakpoint
CREATE TABLE "action_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "action_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"scanned_by" uuid,
	"scanned_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone,
	"result" "scan_result" NOT NULL,
	"offline" boolean DEFAULT false NOT NULL,
	"device_id" text,
	"conflict" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_scans_idempotency_key" UNIQUE NULLS NOT DISTINCT("booking_id","device_id","scanned_at")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"code_hash" text NOT NULL,
	"parking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"spots" integer DEFAULT 1 NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"price_gr" integer NOT NULL,
	"commission_rate_pct" integer NOT NULL,
	"commission_gr" integer NOT NULL,
	"host_payout_gr" integer NOT NULL,
	"refund_policy_id" uuid NOT NULL,
	"vehicle_plate" text,
	"pending_expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"refund_gr" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_spots_positive" CHECK ("bookings"."spots" > 0),
	CONSTRAINT "bookings_range" CHECK ("bookings"."ends_at" > "bookings"."starts_at"),
	CONSTRAINT "bookings_money_split" CHECK ("bookings"."commission_gr" + "bookings"."host_payout_gr" = "bookings"."price_gr")
);
--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"nip" char(10) NOT NULL,
	"company_name" text NOT NULL,
	"address" text,
	"vat_status" text,
	"whitelist_checked_at" timestamp with time zone,
	"whitelist_bank_accounts" jsonb,
	"regon" text,
	"legal_form" text,
	"pkd" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "commission_scope" NOT NULL,
	"user_id" uuid,
	"parking_id" uuid,
	"rate_pct" integer NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_rules_rate_range" CHECK ("commission_rules"."rate_pct" BETWEEN 0 AND 100),
	CONSTRAINT "commission_rules_scope_target" CHECK (("commission_rules"."scope" = 'USER' AND "commission_rules"."user_id" IS NOT NULL AND "commission_rules"."parking_id" IS NULL)
        OR ("commission_rules"."scope" = 'PARKING' AND "commission_rules"."parking_id" IS NOT NULL AND "commission_rules"."user_id" IS NULL)
        OR ("commission_rules"."scope" IN ('GLOBAL_INDIVIDUAL', 'GLOBAL_BUSINESS') AND "commission_rules"."user_id" IS NULL AND "commission_rules"."parking_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "consent_kind" NOT NULL,
	"document_version" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_parking_availability" (
	"event_id" uuid NOT NULL,
	"parking_id" uuid NOT NULL,
	"is_available" boolean NOT NULL,
	"spots" integer,
	"price_gr" integer,
	"notes" text,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_parking_availability_event_id_parking_id_pk" PRIMARY KEY("event_id","parking_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"category" "event_category" DEFAULT 'OTHER' NOT NULL,
	"expected_attendance" integer,
	"search_radius_meters" integer DEFAULT 1500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_range" CHECK ("events"."ends_at" > "events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"template" text NOT NULL,
	"related_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "notification_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_dedup_key" UNIQUE NULLS NOT DISTINCT("user_id","template","related_id")
);
--> statement-breakpoint
CREATE TABLE "parking_availability_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parking_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"spots" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parking_availability_windows_range" CHECK ("parking_availability_windows"."ends_at" > "parking_availability_windows"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "parking_blackout_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parking_id" uuid NOT NULL,
	"date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parking_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parkings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"status" "parking_status" DEFAULT 'DRAFT' NOT NULL,
	"rejection_reason" text,
	"title" text,
	"description" text,
	"location" geography(Point,4326),
	"address" text,
	"capacity" integer,
	"parking_type" "parking_type",
	"access_type" "access_type",
	"access_instructions" text,
	"entrance_location" geography(Point,4326),
	"entrance_notes" text,
	"surface" "surface",
	"is_covered" boolean,
	"is_guarded" boolean,
	"has_cctv" boolean,
	"is_lit" boolean,
	"is_fenced" boolean,
	"max_vehicle_height_cm" integer,
	"max_vehicle_length_cm" integer,
	"vehicle_types" "vehicle_type"[],
	"has_ev_charging" boolean,
	"ev_connector_types" "ev_connector_type"[],
	"has_disabled_access" boolean,
	"disabled_spots_count" integer,
	"availability_mode" "availability_mode" DEFAULT 'ALWAYS' NOT NULL,
	"schedule" jsonb,
	"price_per_hour_gr" integer,
	"price_per_day_gr" integer,
	"price_per_month_gr" integer,
	"price_per_event_gr" integer,
	"min_booking_minutes" integer DEFAULT 30 NOT NULL,
	"free_minutes" integer DEFAULT 0 NOT NULL,
	"payout_bank_account" text,
	"profile_completeness" integer DEFAULT 0 NOT NULL,
	"deleted_owner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parkings_capacity_positive" CHECK ("parkings"."capacity" IS NULL OR "parkings"."capacity" > 0),
	CONSTRAINT "parkings_profile_completeness_range" CHECK ("parkings"."profile_completeness" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_ref" text,
	"method" "payment_method",
	"amount_gr" integer NOT NULL,
	"status" "payment_status" DEFAULT 'INITIATED' NOT NULL,
	"refunded_gr" integer DEFAULT 0 NOT NULL,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_refunded_within_amount" CHECK ("payments"."refunded_gr" BETWEEN 0 AND "payments"."amount_gr")
);
--> statement-breakpoint
CREATE TABLE "payout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount_gr" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount_gr" integer DEFAULT 0 NOT NULL,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"provider" "payment_provider" DEFAULT 'MANUAL' NOT NULL,
	"provider_ref" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"phone" text,
	"password_hash" text,
	"first_name" text,
	"last_name" text,
	"email_verified_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"location" geography(Point,4326) NOT NULL,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"provider" "payment_provider" NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_hash" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_provider_event_id_pk" PRIMARY KEY("provider","event_id")
);
--> statement-breakpoint
ALTER TABLE "action_tokens" ADD CONSTRAINT "action_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_scans" ADD CONSTRAINT "booking_scans_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_scans" ADD CONSTRAINT "booking_scans_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_refund_policy_id_refund_policies_id_fk" FOREIGN KEY ("refund_policy_id") REFERENCES "public"."refund_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_parking_availability" ADD CONSTRAINT "event_parking_availability_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_parking_availability" ADD CONSTRAINT "event_parking_availability_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_availability_windows" ADD CONSTRAINT "parking_availability_windows_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_blackout_dates" ADD CONSTRAINT "parking_blackout_dates_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_photos" ADD CONSTRAINT "parking_photos_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parkings" ADD CONSTRAINT "parkings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_tokens_token_hash_key" ON "action_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "action_tokens_user_id_purpose_idx" ON "action_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "booking_scans_booking_id_idx" ON "booking_scans" USING btree ("booking_id","scanned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "bookings_code_hash_idx" ON "bookings" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "bookings_occupancy_idx" ON "bookings" USING btree ("parking_id","starts_at","ends_at") WHERE "bookings"."status" IN ('PENDING', 'CONFIRMED');--> statement-breakpoint
CREATE INDEX "bookings_user_id_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_event_id_idx" ON "bookings" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_profiles_nip_key" ON "business_profiles" USING btree ("nip");--> statement-breakpoint
CREATE INDEX "commission_rules_scope_valid_from_idx" ON "commission_rules" USING btree ("scope","valid_from");--> statement-breakpoint
CREATE INDEX "commission_rules_user_id_idx" ON "commission_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "commission_rules_parking_id_idx" ON "commission_rules" USING btree ("parking_id");--> statement-breakpoint
CREATE INDEX "consents_user_id_kind_idx" ON "consents" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "event_parking_availability_parking_id_idx" ON "event_parking_availability" USING btree ("parking_id");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_venue_title_starts_at_key" ON "events" USING btree ("venue_id","title","starts_at");--> statement-breakpoint
CREATE INDEX "parking_availability_windows_range_idx" ON "parking_availability_windows" USING btree ("parking_id","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "parking_blackout_dates_parking_id_date_key" ON "parking_blackout_dates" USING btree ("parking_id","date");--> statement-breakpoint
CREATE INDEX "parking_photos_parking_id_idx" ON "parking_photos" USING btree ("parking_id","sort_order");--> statement-breakpoint
CREATE INDEX "parkings_location_gist_idx" ON "parkings" USING gist ("location");--> statement-breakpoint
CREATE INDEX "parkings_entrance_location_gist_idx" ON "parkings" USING gist ("entrance_location");--> statement-breakpoint
CREATE INDEX "parkings_status_idx" ON "parkings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "parkings_owner_id_idx" ON "parkings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "parkings_moderation_queue_idx" ON "parkings" USING btree ("created_at") WHERE "parkings"."status" = 'PENDING_REVIEW';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_booking_id_key" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_items_booking_id_key" ON "payout_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payout_items_payout_id_idx" ON "payout_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "payouts_host_id_idx" ON "payouts" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_host_period_key" ON "payouts" USING btree ("host_id","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_policies_name_valid_from_key" ON "refund_policies" USING btree ("name","valid_from");--> statement-breakpoint
CREATE INDEX "refund_policies_default_idx" ON "refund_policies" USING btree ("valid_from") WHERE "refund_policies"."is_default";--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "venues_location_gist_idx" ON "venues" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_name_key" ON "venues" USING btree ("name");