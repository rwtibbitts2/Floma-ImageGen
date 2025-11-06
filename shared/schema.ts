import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
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

// Media Adapters - for media-specific prompt adjustments
export const mediaAdapters = pgTable("media_adapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  vocabularyAdjustments: text("vocabulary_adjustments"), // Specific terminology to use/avoid for this media type
  lightingAdjustments: text("lighting_adjustments"), // Lighting-specific rules and considerations
  surfaceAdjustments: text("surface_adjustments"), // Surface behavior rules for this media type
  conceptualAdjustments: text("conceptual_adjustments"), // Concept generation rules specific to this media
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Image Style Configuration
export const imageStyles = pgTable("image_styles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  stylePrompt: text("style_prompt"), // Core system prompt for visual style (lighting, colors, materials)
  compositionPrompt: text("composition_prompt"), // Core system prompt for spatial composition (layout, perspective, depth)
  conceptPrompt: text("concept_prompt"), // Core system prompt for concept generation (metaphors, subject ideation)
  compositionFramework: jsonb("composition_framework").$type<Record<string, any>>(), // Full structured JSON for composition analysis
  conceptFramework: jsonb("concept_framework").$type<Record<string, any>>(), // Full structured JSON for concept analysis
  mediaAdapterId: varchar("media_adapter_id").references(() => mediaAdapters.id), // Media-specific adapter to merge with core prompts
  referenceImageUrl: text("reference_image_url"), // URL to reference image in object storage
  isAiExtracted: boolean("is_ai_extracted").default(false), // Track if style was AI-extracted
  previewImageUrl: text("preview_image_url"), // URL to preview image generated during extraction
  testConcepts: jsonb("test_concepts").$type<string[]>(), // 3 test concepts generated during extraction
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id), // Optional: track who created the style
});

// Generation Job
export const generationJobs = pgTable("generation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  userId: varchar("user_id").references(() => users.id), // Associate job with user (nullable for migration)
  sessionId: varchar("session_id").references(() => projectSessions.id), // Link job to session for image persistence
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
  sourceImageId: varchar("source_image_id"), // For regeneration - links to the original image (self-reference)
  visualConcept: text("visual_concept").notNull(),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  regenerationInstruction: text("regeneration_instruction"), // Store the instruction used for regeneration
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

// User Preferences - for storing default extraction prompts and other settings
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  defaultExtractionPrompt: text("default_extraction_prompt"),
  defaultConceptPrompt: text("default_concept_prompt"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System Prompts - reusable prompts for different purposes
export const systemPrompts = pgTable("system_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  promptText: text("prompt_text").notNull(),
  category: text("category").$type<"style_extraction" | "concept_generation">().notNull(),
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Concept object structure - flexible to support custom prompt formats
export const conceptSchema = z.record(z.any());

export type Concept = Record<string, any>;

// Concept Lists - AI-generated marketing concept lists
export const conceptLists = pgTable("concept_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  companyName: text("company_name").notNull(),
  referenceImageUrl: text("reference_image_url"),
  marketingContent: text("marketing_content").notNull(),
  promptId: varchar("prompt_id").references(() => systemPrompts.id),
  promptText: text("prompt_text"),
  temperature: real("temperature").default(0.7),
  literalMetaphorical: real("literal_metaphorical").default(0),
  simpleComplex: real("simple_complex").default(0),
  concepts: jsonb("concepts").$type<Concept[]>().notNull(),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas
export const generationSettingsSchema = z.object({
  model: z.enum(["dall-e-2", "dall-e-3", "gpt-image-1"]).default("gpt-image-1"),
  quality: z.enum(["standard", "hd"]).default("standard"),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
  transparency: z.boolean().default(false),
  variations: z.number().min(1).max(4).default(1),
});

export const visualConceptsSchema = z.array(z.string().min(1));

// Insert Schemas - From blueprint:javascript_auth_all_persistance  
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, lastLogin: true });
export const insertMediaAdapterSchema = createInsertSchema(mediaAdapters).omit({ id: true, createdAt: true, updatedAt: true });
export const insertImageStyleSchema = createInsertSchema(imageStyles).omit({ id: true, createdAt: true });
export const insertGenerationJobSchema = createInsertSchema(generationJobs).omit({ id: true, createdAt: true, status: true, progress: true });
export const insertGeneratedImageSchema = createInsertSchema(generatedImages).omit({ id: true, createdAt: true, status: true });
export const insertProjectSessionSchema = createInsertSchema(projectSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSystemPromptSchema = createInsertSchema(systemPrompts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConceptListSchema = createInsertSchema(conceptLists).omit({ id: true, createdAt: true, updatedAt: true });

// Relations - Updated for user authentication
export const usersRelations = relations(users, ({ many, one }) => ({
  projectSessions: many(projectSessions),
  generationJobs: many(generationJobs), 
  generatedImages: many(generatedImages),
  conceptLists: many(conceptLists),
  preferences: one(userPreferences),
  mediaAdapters: many(mediaAdapters),
}));

export const mediaAdaptersRelations = relations(mediaAdapters, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [mediaAdapters.createdBy],
    references: [users.id],
  }),
  imageStyles: many(imageStyles),
}));

export const imageStylesRelations = relations(imageStyles, ({ many, one }) => ({
  generationJobs: many(generationJobs),
  createdBy: one(users, {
    fields: [imageStyles.createdBy],
    references: [users.id],
  }),
  mediaAdapter: one(mediaAdapters, {
    fields: [imageStyles.mediaAdapterId],
    references: [mediaAdapters.id],
  }),
}));

export const generationJobsRelations = relations(generationJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [generationJobs.userId],
    references: [users.id],
  }),
  session: one(projectSessions, {
    fields: [generationJobs.sessionId],
    references: [projectSessions.id],
  }),
  style: one(imageStyles, {
    fields: [generationJobs.styleId],
    references: [imageStyles.id],
  }),
  generatedImages: many(generatedImages),
}));

export const generatedImagesRelations = relations(generatedImages, ({ one, many }) => ({
  user: one(users, {
    fields: [generatedImages.userId],
    references: [users.id],
  }),
  job: one(generationJobs, {
    fields: [generatedImages.jobId],
    references: [generationJobs.id],
  }),
  sourceImage: one(generatedImages, {
    fields: [generatedImages.sourceImageId],
    references: [generatedImages.id],
    relationName: "imageRegeneration",
  }),
  regeneratedImages: many(generatedImages, {
    relationName: "imageRegeneration",
  }),
}));

export const projectSessionsRelations = relations(projectSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [projectSessions.userId],
    references: [users.id],
  }),
  style: one(imageStyles, {
    fields: [projectSessions.styleId],
    references: [imageStyles.id],
  }),
  generationJobs: many(generationJobs),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const systemPromptsRelations = relations(systemPrompts, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [systemPrompts.createdBy],
    references: [users.id],
  }),
  conceptLists: many(conceptLists),
}));

export const conceptListsRelations = relations(conceptLists, ({ one }) => ({
  user: one(users, {
    fields: [conceptLists.userId],
    references: [users.id],
  }),
  prompt: one(systemPrompts, {
    fields: [conceptLists.promptId],
    references: [systemPrompts.id],
  }),
}));

// Types - From blueprint:javascript_auth_all_persistance
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MediaAdapter = typeof mediaAdapters.$inferSelect;
export type InsertMediaAdapter = z.infer<typeof insertMediaAdapterSchema>;
export type ImageStyle = typeof imageStyles.$inferSelect;
export type InsertImageStyle = z.infer<typeof insertImageStyleSchema>;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type ProjectSession = typeof projectSessions.$inferSelect;
export type InsertProjectSession = z.infer<typeof insertProjectSessionSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = z.infer<typeof insertSystemPromptSchema>;
export type ConceptList = typeof conceptLists.$inferSelect;
export type InsertConceptList = z.infer<typeof insertConceptListSchema>;
