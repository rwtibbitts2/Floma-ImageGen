import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication - From blueprint:javascript_auth_all_persistance
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // Will store hashed password
  role: text("role").$type<"admin" | "user">().default("user"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

// Image Style Configuration
export const imageStyles = pgTable("image_styles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  stylePrompt: text("style_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id), // Optional: track who created the style
});

// Generation Job
export const generationJobs = pgTable("generation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  userId: varchar("user_id").references(() => users.id), // Associate job with user (nullable for migration)
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
  userId: varchar("user_id").references(() => users.id), // Associate image with user (nullable for migration)
  jobId: varchar("job_id").references(() => generationJobs.id),
  visualConcept: text("visual_concept").notNull(),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").$type<"generating" | "completed" | "failed">().default("generating"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project Sessions - for saving and loading generation sessions
export const projectSessions = pgTable("project_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Associate session with user (nullable for migration)
  name: text("name"),
  displayName: text("display_name").notNull(), // Auto-generated from date/time or custom name
  styleId: varchar("style_id").references(() => imageStyles.id),
  visualConcepts: jsonb("visual_concepts").$type<string[]>().notNull(),
  settings: jsonb("settings").$type<GenerationSettings>().notNull(),
  isTemporary: jsonb("is_temporary").$type<boolean>().default(false), // For autosave functionality
  hasUnsavedChanges: jsonb("has_unsaved_changes").$type<boolean>().default(false), // Track unsaved changes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas
export const generationSettingsSchema = z.object({
  model: z.enum(["dall-e-2", "dall-e-3", "gpt-image-1"]).default("dall-e-3"),
  quality: z.enum(["standard", "hd"]).default("standard"),
  size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).default("1024x1024"),
  transparency: z.boolean().default(false),
  variations: z.number().min(1).max(4).default(1),
});

export const visualConceptsSchema = z.array(z.string().min(1));

// Insert Schemas - From blueprint:javascript_auth_all_persistance  
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, lastLogin: true });
export const insertImageStyleSchema = createInsertSchema(imageStyles).omit({ id: true, createdAt: true });
export const insertGenerationJobSchema = createInsertSchema(generationJobs).omit({ id: true, createdAt: true, status: true, progress: true });
export const insertGeneratedImageSchema = createInsertSchema(generatedImages).omit({ id: true, createdAt: true, status: true });
export const insertProjectSessionSchema = createInsertSchema(projectSessions).omit({ id: true, createdAt: true, updatedAt: true });

// Relations - Updated for user authentication
export const usersRelations = relations(users, ({ many }) => ({
  projectSessions: many(projectSessions),
  generationJobs: many(generationJobs), 
  generatedImages: many(generatedImages),
}));

export const imageStylesRelations = relations(imageStyles, ({ many, one }) => ({
  generationJobs: many(generationJobs),
  createdBy: one(users, {
    fields: [imageStyles.createdBy],
    references: [users.id],
  }),
}));

export const generationJobsRelations = relations(generationJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [generationJobs.userId],
    references: [users.id],
  }),
  style: one(imageStyles, {
    fields: [generationJobs.styleId],
    references: [imageStyles.id],
  }),
  generatedImages: many(generatedImages),
}));

export const generatedImagesRelations = relations(generatedImages, ({ one }) => ({
  user: one(users, {
    fields: [generatedImages.userId],
    references: [users.id],
  }),
  job: one(generationJobs, {
    fields: [generatedImages.jobId],
    references: [generationJobs.id],
  }),
}));

export const projectSessionsRelations = relations(projectSessions, ({ one }) => ({
  user: one(users, {
    fields: [projectSessions.userId],
    references: [users.id],
  }),
  style: one(imageStyles, {
    fields: [projectSessions.styleId],
    references: [imageStyles.id],
  }),
}));

// Types - From blueprint:javascript_auth_all_persistance
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ImageStyle = typeof imageStyles.$inferSelect;
export type InsertImageStyle = z.infer<typeof insertImageStyleSchema>;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type ProjectSession = typeof projectSessions.$inferSelect;
export type InsertProjectSession = z.infer<typeof insertProjectSessionSchema>;
