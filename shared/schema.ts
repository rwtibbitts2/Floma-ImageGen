import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Image Style Configuration
export const imageStyles = pgTable("image_styles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  stylePrompt: text("style_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Generation Job
export const generationJobs = pgTable("generation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  styleId: varchar("style_id").references(() => imageStyles.id),
  visualConcepts: jsonb("visual_concepts").$type<string[]>().notNull(),
  settings: jsonb("settings").$type<GenerationSettings>().notNull(),
  status: text("status").$type<"pending" | "running" | "completed" | "failed">().default("pending"),
  progress: integer("progress").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Generated Images
export const generatedImages = pgTable("generated_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => generationJobs.id),
  visualConcept: text("visual_concept").notNull(),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").$type<"generating" | "completed" | "failed">().default("generating"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod Schemas
export const generationSettingsSchema = z.object({
  quality: z.enum(["standard", "hd"]).default("standard"),
  size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).default("1024x1024"),
  transparency: z.boolean().default(false),
  variations: z.number().min(1).max(4).default(1),
});

export const visualConceptsSchema = z.array(z.string().min(1));

export const insertImageStyleSchema = createInsertSchema(imageStyles).omit({ id: true, createdAt: true });
export const insertGenerationJobSchema = createInsertSchema(generationJobs).omit({ id: true, createdAt: true, status: true, progress: true });
export const insertGeneratedImageSchema = createInsertSchema(generatedImages).omit({ id: true, createdAt: true, status: true });

// Types
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export type ImageStyle = typeof imageStyles.$inferSelect;
export type InsertImageStyle = z.infer<typeof insertImageStyleSchema>;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
