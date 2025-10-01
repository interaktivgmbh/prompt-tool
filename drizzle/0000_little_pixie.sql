CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar(255) NOT NULL,
	"prompt_id" uuid NOT NULL,
	"chunk_id" varchar(100) NOT NULL,
	"text" text NOT NULL,
	"vector" vector(3072) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"domain_id" varchar(255) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"nextcloud_path" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar(255) NOT NULL,
	"name" varchar(255),
	"description" text,
	"prompt" text,
	"metadata" jsonb,
	"model_id" varchar(100),
	"model_provider" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_files" ADD CONSTRAINT "prompt_files_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embeddings_domain_id_idx" ON "embeddings" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "embeddings_prompt_id_idx" ON "embeddings" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "prompt_files_prompt_id_idx" ON "prompt_files" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "prompt_files_domain_id_idx" ON "prompt_files" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "prompts_domain_id_idx" ON "prompts" USING btree ("domain_id");