CREATE TABLE "cameras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cameras_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "lenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lenses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "camera_id" uuid;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "lens_id" uuid;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "aperture" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "shutter_speed" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "iso" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_camera_id_cameras_id_fk" FOREIGN KEY ("camera_id") REFERENCES "public"."cameras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_lens_id_lenses_id_fk" FOREIGN KEY ("lens_id") REFERENCES "public"."lenses"("id") ON DELETE set null ON UPDATE no action;