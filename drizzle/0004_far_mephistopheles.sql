ALTER TYPE "public"."role" ADD VALUE 'HOST_EMPLOYEE';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "employer_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_employer_id_idx" ON "users" USING btree ("employer_id");