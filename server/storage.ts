import { type ImageStyle, type InsertImageStyle, type GenerationJob, type InsertGenerationJob, type GeneratedImage, type InsertGeneratedImage, type ProjectSession, type InsertProjectSession, type GenerationSettings, type User, type InsertUser, type UserPreferences, type InsertUserPreferences, type SystemPrompt, type InsertSystemPrompt, type ConceptList, type InsertConceptList, type MediaAdapter, type InsertMediaAdapter, imageStyles, generationJobs, generatedImages, projectSessions, users, userPreferences, systemPrompts, conceptLists, mediaAdapters } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, pool } from "./db";
import { eq, desc, inArray, and, isNull, ne } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";

// Fix session store type imports - Use session.Store not session.SessionStore
type SessionStore = session.Store;

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Session store for authentication - From blueprint:javascript_auth_all_persistance
  sessionStore: SessionStore;
  
  // User authentication management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserLastLogin(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deactivateUser(id: string): Promise<User | undefined>;
  
  // Image Style management
  getImageStyleById(id: string): Promise<ImageStyle | undefined>;
  getAllImageStyles(): Promise<ImageStyle[]>;
  createImageStyle(style: InsertImageStyle): Promise<ImageStyle>;
  updateImageStyle(id: string, updates: Partial<InsertImageStyle>): Promise<ImageStyle | undefined>;
  deleteImageStyle(id: string): Promise<boolean>;
  duplicateImageStyle(id: string, userId: string): Promise<ImageStyle | undefined>;
  
  // Generation Job management
  getGenerationJobById(id: string): Promise<GenerationJob | undefined>;
  createGenerationJob(job: InsertGenerationJob): Promise<GenerationJob>;
  updateGenerationJob(id: string, updates: Partial<GenerationJob>): Promise<GenerationJob | undefined>;
  
  // Generated Image management
  getGeneratedImageById(id: string): Promise<GeneratedImage | undefined>;
  getGeneratedImagesByJobId(jobId: string): Promise<GeneratedImage[]>;
  getGeneratedImagesBySessionId(sessionId: string): Promise<GeneratedImage[]>;
  createGeneratedImage(image: InsertGeneratedImage): Promise<GeneratedImage>;
  updateGeneratedImage(id: string, updates: Partial<GeneratedImage>): Promise<GeneratedImage | undefined>;
  
  // Project Session management
  getProjectSessionById(id: string): Promise<ProjectSession | undefined>;
  getAllProjectSessions(): Promise<ProjectSession[]>;
  createProjectSession(session: InsertProjectSession): Promise<ProjectSession>;
  updateProjectSession(id: string, updates: Partial<InsertProjectSession>): Promise<ProjectSession | undefined>;
  deleteProjectSession(id: string): Promise<boolean>;
  getTemporarySession(): Promise<ProjectSession | undefined>;
  clearTemporarySessions(): Promise<void>;
  getTemporarySessionsForUser(userId: string): Promise<ProjectSession[]>;
  clearTemporarySessionsForUser(userId: string): Promise<number>;
  migrateGenerationJobsToSession(sourceSessionId: string, targetSessionId: string): Promise<number>;
  getWorkingSessionForUser(userId: string): Promise<ProjectSession | undefined>;
  
  // User Preferences management
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: string, preferences: { defaultExtractionPrompt: string; defaultConceptPrompt: string }): Promise<UserPreferences>;
  
  // System Prompts management
  getSystemPromptById(id: string): Promise<SystemPrompt | undefined>;
  getAllSystemPrompts(): Promise<SystemPrompt[]>;
  getSystemPromptsByCategory(category: "style_extraction" | "concept_generation"): Promise<SystemPrompt[]>;
  getDefaultSystemPromptByCategory(category: "style_extraction" | "concept_generation"): Promise<SystemPrompt | undefined>;
  createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt>;
  updateSystemPrompt(id: string, updates: Partial<InsertSystemPrompt>): Promise<SystemPrompt | undefined>;
  deleteSystemPrompt(id: string): Promise<boolean>;
  
  // Media Adapter management
  getMediaAdapterById(id: string): Promise<MediaAdapter | undefined>;
  getAllMediaAdapters(): Promise<MediaAdapter[]>;
  getDefaultMediaAdapter(): Promise<MediaAdapter | undefined>;
  createMediaAdapter(adapter: InsertMediaAdapter): Promise<MediaAdapter>;
  updateMediaAdapter(id: string, updates: Partial<InsertMediaAdapter>): Promise<MediaAdapter | undefined>;
  deleteMediaAdapter(id: string): Promise<boolean>;
  
  // Concept List management
  getConceptListById(id: string): Promise<ConceptList | undefined>;
  getAllConceptLists(): Promise<ConceptList[]>;
  createConceptList(conceptList: InsertConceptList): Promise<ConceptList>;
  updateConceptList(id: string, updates: Partial<InsertConceptList>): Promise<ConceptList | undefined>;
  deleteConceptList(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private imageStyles: Map<string, ImageStyle>;
  private generationJobs: Map<string, GenerationJob>;
  private generatedImages: Map<string, GeneratedImage>;
  private projectSessions: Map<string, ProjectSession>;
  private users: Map<string, User>;
  private userPreferences: Map<string, UserPreferences>;
  private systemPrompts: Map<string, SystemPrompt>;
  private mediaAdapters: Map<string, MediaAdapter>;
  private conceptLists: Map<string, ConceptList>;
  sessionStore: SessionStore;

  constructor() {
    this.imageStyles = new Map();
    this.generationJobs = new Map();
    this.generatedImages = new Map();
    this.projectSessions = new Map();
    this.users = new Map();
    this.userPreferences = new Map();
    this.systemPrompts = new Map();
    this.mediaAdapters = new Map();
    this.conceptLists = new Map();
    
    // Initialize memory session store - From blueprint:javascript_auth_all_persistance
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  async getImageStyleById(id: string): Promise<ImageStyle | undefined> {
    return this.imageStyles.get(id);
  }

  async getAllImageStyles(): Promise<ImageStyle[]> {
    return Array.from(this.imageStyles.values());
  }

  async createImageStyle(insertStyle: InsertImageStyle): Promise<ImageStyle> {
    const id = randomUUID();
    const style: ImageStyle = { 
      ...insertStyle,
      id, 
      referenceImageUrl: insertStyle.referenceImageUrl || null,
      isAiExtracted: insertStyle.isAiExtracted || false,
      stylePrompt: insertStyle.stylePrompt || null,
      compositionPrompt: insertStyle.compositionPrompt || null,
      conceptPrompt: insertStyle.conceptPrompt || null,
      previewImageUrl: insertStyle.previewImageUrl || null,
      createdAt: new Date(),
      createdBy: insertStyle.createdBy || null
    };
    this.imageStyles.set(id, style);
    return style;
  }

  async getGenerationJobById(id: string): Promise<GenerationJob | undefined> {
    return this.generationJobs.get(id);
  }

  async createGenerationJob(insertJob: InsertGenerationJob): Promise<GenerationJob> {
    const id = randomUUID();
    const job: GenerationJob = {
      id,
      name: insertJob.name,
      userId: insertJob.userId || null, // Actually use the provided userId value
      sessionId: insertJob.sessionId || null, // Store sessionId for image persistence linking
      status: 'pending',
      progress: 0,
      styleId: insertJob.styleId || null,
      visualConcepts: Array.isArray(insertJob.visualConcepts) ? insertJob.visualConcepts : [],
      settings: insertJob.settings as GenerationSettings,
      createdAt: new Date()
    };
    this.generationJobs.set(id, job);
    return job;
  }

  async updateGenerationJob(id: string, updates: Partial<GenerationJob>): Promise<GenerationJob | undefined> {
    const job = this.generationJobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.generationJobs.set(id, updatedJob);
    return updatedJob;
  }

  async getGeneratedImageById(id: string): Promise<GeneratedImage | undefined> {
    return this.generatedImages.get(id);
  }

  async getGeneratedImagesByJobId(jobId: string): Promise<GeneratedImage[]> {
    return Array.from(this.generatedImages.values()).filter(
      (image) => image.jobId === jobId
    );
  }

  async getGeneratedImagesBySessionId(sessionId: string): Promise<GeneratedImage[]> {
    // Find all jobs for this session
    const sessionJobs = Array.from(this.generationJobs.values()).filter(
      (job) => job.sessionId === sessionId
    );
    
    // Get all jobIds for this session
    const jobIds = new Set(sessionJobs.map(job => job.id));
    
    // Return only completed images that belong to any of these jobs
    return Array.from(this.generatedImages.values()).filter(
      (image) => jobIds.has(image.jobId) && image.status === 'completed'
    );
  }

  async createGeneratedImage(insertImage: InsertGeneratedImage): Promise<GeneratedImage> {
    const id = randomUUID();
    const image: GeneratedImage = {
      id,
      userId: insertImage.userId || null,
      jobId: insertImage.jobId || null,
      sourceImageId: insertImage.sourceImageId || null,
      visualConcept: insertImage.visualConcept,
      imageUrl: insertImage.imageUrl,
      prompt: insertImage.prompt,
      regenerationInstruction: insertImage.regenerationInstruction || null,
      status: 'generating',
      createdAt: new Date()
    };
    this.generatedImages.set(id, image);
    return image;
  }

  async updateGeneratedImage(id: string, updates: Partial<GeneratedImage>): Promise<GeneratedImage | undefined> {
    const image = this.generatedImages.get(id);
    if (!image) return undefined;
    
    // Protect ownership fields from tampering
    const { userId, ...safeUpdates } = updates;
    const updatedImage = { ...image, ...safeUpdates };
    this.generatedImages.set(id, updatedImage);
    return updatedImage;
  }

  async updateImageStyle(id: string, updates: Partial<InsertImageStyle>): Promise<ImageStyle | undefined> {
    const style = this.imageStyles.get(id);
    if (!style) return undefined;
    
    // Protect ownership fields from tampering
    const { createdBy, ...safeUpdates } = updates;
    const updatedStyle = { ...style, ...safeUpdates };
    this.imageStyles.set(id, updatedStyle);
    return updatedStyle;
  }

  async deleteImageStyle(id: string): Promise<boolean> {
    return this.imageStyles.delete(id);
  }

  async duplicateImageStyle(id: string, userId: string): Promise<ImageStyle | undefined> {
    const originalStyle = this.imageStyles.get(id);
    if (!originalStyle) return undefined;

    const newStyle: ImageStyle = {
      ...originalStyle,
      id: randomUUID(),
      name: `${originalStyle.name} (Copy)`,
      createdBy: userId,
      createdAt: new Date()
    };

    this.imageStyles.set(newStyle.id, newStyle);
    return newStyle;
  }
  
  // User authentication methods - From blueprint:javascript_auth_all_persistance
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      password: insertUser.password,
      role: (insertUser.role || 'user') as 'admin' | 'user',
      isActive: insertUser.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLogin = new Date();
      this.users.set(id, user);
    }
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deactivateUser(id: string): Promise<User | undefined> {
    return this.updateUser(id, { isActive: false });
  }

  // Project Session methods for MemStorage
  async getProjectSessionById(id: string): Promise<ProjectSession | undefined> {
    return this.projectSessions.get(id);
  }

  async getAllProjectSessions(): Promise<ProjectSession[]> {
    return Array.from(this.projectSessions.values());
  }

  // User-scoped session methods for security
  async getProjectSessionsForUser(userId: string): Promise<ProjectSession[]> {
    return Array.from(this.projectSessions.values()).filter(session => 
      session.userId === userId
    );
  }

  async createProjectSession(insertSession: InsertProjectSession): Promise<ProjectSession> {
    const id = randomUUID();
    const session: ProjectSession = {
      id,
      userId: insertSession.userId || null, // Actually use the provided userId value
      name: insertSession.name || null,
      displayName: insertSession.displayName,
      styleId: insertSession.styleId || null,
      visualConcepts: Array.isArray(insertSession.visualConcepts) ? insertSession.visualConcepts as string[] : [],
      settings: insertSession.settings as GenerationSettings,
      isTemporary: Boolean(insertSession.isTemporary) || false,
      hasUnsavedChanges: Boolean(insertSession.hasUnsavedChanges) || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.projectSessions.set(id, session);
    return session;
  }

  async updateProjectSession(id: string, updates: Partial<InsertProjectSession>): Promise<ProjectSession | undefined> {
    const session = this.projectSessions.get(id);
    if (!session) return undefined;
    
    // Protect ownership fields from tampering
    const { userId, ...cleanUpdates } = updates;
    
    // Ensure proper types for updates
    const safeUpdates: Partial<ProjectSession> = {
      ...cleanUpdates,
      visualConcepts: cleanUpdates.visualConcepts ? Array.isArray(cleanUpdates.visualConcepts) ? cleanUpdates.visualConcepts : [] : session.visualConcepts,
      settings: cleanUpdates.settings ? cleanUpdates.settings as GenerationSettings : session.settings,
      isTemporary: cleanUpdates.isTemporary !== undefined ? Boolean(cleanUpdates.isTemporary) : session.isTemporary,
      hasUnsavedChanges: cleanUpdates.hasUnsavedChanges !== undefined ? Boolean(cleanUpdates.hasUnsavedChanges) : session.hasUnsavedChanges,
      updatedAt: new Date()
    };
    
    const updatedSession = { ...session, ...safeUpdates };
    this.projectSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteProjectSession(id: string): Promise<boolean> {
    return this.projectSessions.delete(id);
  }

  async getTemporarySession(): Promise<ProjectSession | undefined> {
    return Array.from(this.projectSessions.values()).find(session => session.isTemporary);
  }

  async clearTemporarySessions(): Promise<void> {
    Array.from(this.projectSessions.entries()).forEach(([id, session]) => {
      if (session.isTemporary) {
        this.projectSessions.delete(id);
      }
    });
  }

  async getTemporarySessionsForUser(userId: string): Promise<ProjectSession[]> {
    return Array.from(this.projectSessions.values()).filter(session => 
      session.userId === userId && session.isTemporary
    );
  }

  async clearTemporarySessionsForUser(userId: string): Promise<number> {
    let deletedCount = 0;
    for (const [sessionId, session] of this.projectSessions) {
      if (session.userId === userId && session.isTemporary) {
        this.projectSessions.delete(sessionId);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async migrateGenerationJobsToSession(sourceSessionId: string, targetSessionId: string): Promise<number> {
    let migratedCount = 0;
    for (const [jobId, job] of this.generationJobs) {
      if (job.sessionId === sourceSessionId) {
        job.sessionId = targetSessionId;
        migratedCount++;
      }
    }
    return migratedCount;
  }

  async getWorkingSessionForUser(userId: string): Promise<ProjectSession | undefined> {
    // Find the working session for a user (sessions without a name, most recently updated)
    let workingSession: ProjectSession | undefined;
    for (const session of this.projectSessions.values()) {
      if (session.userId === userId && session.name === null && !session.isTemporary) {
        if (!workingSession || (session.updatedAt && session.updatedAt > workingSession.updatedAt)) {
          workingSession = session;
        }
      }
    }
    return workingSession;
  }

  // User Preferences methods
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return Array.from(this.userPreferences.values()).find(prefs => prefs.userId === userId);
  }

  async updateUserPreferences(userId: string, preferences: { defaultExtractionPrompt: string; defaultConceptPrompt: string }): Promise<UserPreferences> {
    // Find existing preferences or create new ones
    const existingPrefs = await this.getUserPreferences(userId);
    
    if (existingPrefs) {
      // Update existing preferences
      const updatedPrefs: UserPreferences = {
        ...existingPrefs,
        defaultExtractionPrompt: preferences.defaultExtractionPrompt,
        defaultConceptPrompt: preferences.defaultConceptPrompt,
        updatedAt: new Date()
      };
      this.userPreferences.set(existingPrefs.id, updatedPrefs);
      return updatedPrefs;
    } else {
      // Create new preferences
      const id = randomUUID();
      const newPrefs: UserPreferences = {
        id,
        userId,
        defaultExtractionPrompt: preferences.defaultExtractionPrompt,
        defaultConceptPrompt: preferences.defaultConceptPrompt,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.userPreferences.set(id, newPrefs);
      return newPrefs;
    }
  }

  // System Prompts methods
  async getSystemPromptById(id: string): Promise<SystemPrompt | undefined> {
    return this.systemPrompts.get(id);
  }

  async getAllSystemPrompts(): Promise<SystemPrompt[]> {
    return Array.from(this.systemPrompts.values());
  }

  async getSystemPromptsByCategory(category: "style_extraction" | "concept_generation"): Promise<SystemPrompt[]> {
    return Array.from(this.systemPrompts.values()).filter(prompt => prompt.category === category);
  }

  async getDefaultSystemPromptByCategory(category: "style_extraction" | "concept_generation"): Promise<SystemPrompt | undefined> {
    return Array.from(this.systemPrompts.values()).find(prompt => prompt.category === category && prompt.isDefault);
  }

  async createSystemPrompt(insertPrompt: InsertSystemPrompt): Promise<SystemPrompt> {
    const id = randomUUID();
    const prompt: SystemPrompt = {
      ...insertPrompt,
      id,
      description: insertPrompt.description || null,
      isDefault: insertPrompt.isDefault || false,
      createdBy: insertPrompt.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.systemPrompts.set(id, prompt);
    return prompt;
  }

  async updateSystemPrompt(id: string, updates: Partial<InsertSystemPrompt>): Promise<SystemPrompt | undefined> {
    const prompt = this.systemPrompts.get(id);
    if (!prompt) return undefined;

    const updatedPrompt: SystemPrompt = {
      ...prompt,
      ...updates,
      updatedAt: new Date()
    };
    this.systemPrompts.set(id, updatedPrompt);
    return updatedPrompt;
  }

  async deleteSystemPrompt(id: string): Promise<boolean> {
    return this.systemPrompts.delete(id);
  }

  // Media Adapter methods
  async getMediaAdapterById(id: string): Promise<MediaAdapter | undefined> {
    return this.mediaAdapters.get(id);
  }

  async getAllMediaAdapters(): Promise<MediaAdapter[]> {
    return Array.from(this.mediaAdapters.values());
  }

  async getDefaultMediaAdapter(): Promise<MediaAdapter | undefined> {
    return Array.from(this.mediaAdapters.values()).find(adapter => adapter.isDefault);
  }

  async createMediaAdapter(insertAdapter: InsertMediaAdapter): Promise<MediaAdapter> {
    // If setting as default, unset all other defaults
    if (insertAdapter.isDefault) {
      for (const [adapterId, adapter] of this.mediaAdapters.entries()) {
        if (adapter.isDefault) {
          this.mediaAdapters.set(adapterId, { ...adapter, isDefault: false, updatedAt: new Date() });
        }
      }
    }
    
    const id = randomUUID();
    const adapter: MediaAdapter = {
      ...insertAdapter,
      id,
      description: insertAdapter.description || null,
      vocabularyAdjustments: insertAdapter.vocabularyAdjustments || null,
      lightingAdjustments: insertAdapter.lightingAdjustments || null,
      surfaceAdjustments: insertAdapter.surfaceAdjustments || null,
      conceptualAdjustments: insertAdapter.conceptualAdjustments || null,
      isDefault: insertAdapter.isDefault || false,
      createdBy: insertAdapter.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.mediaAdapters.set(id, adapter);
    return adapter;
  }

  async updateMediaAdapter(id: string, updates: Partial<InsertMediaAdapter>): Promise<MediaAdapter | undefined> {
    const adapter = this.mediaAdapters.get(id);
    if (!adapter) return undefined;

    // If setting as default, unset all other defaults
    if (updates.isDefault === true) {
      for (const [adapterId, adapter] of this.mediaAdapters.entries()) {
        if (adapterId !== id && adapter.isDefault) {
          this.mediaAdapters.set(adapterId, { ...adapter, isDefault: false, updatedAt: new Date() });
        }
      }
    }

    const updatedAdapter: MediaAdapter = {
      ...adapter,
      ...updates,
      updatedAt: new Date()
    };
    this.mediaAdapters.set(id, updatedAdapter);
    return updatedAdapter;
  }

  async deleteMediaAdapter(id: string): Promise<boolean> {
    return this.mediaAdapters.delete(id);
  }

  async getConceptListById(id: string): Promise<ConceptList | undefined> {
    return this.conceptLists.get(id);
  }

  async getAllConceptLists(): Promise<ConceptList[]> {
    return Array.from(this.conceptLists.values());
  }

  async createConceptList(insertConceptList: InsertConceptList): Promise<ConceptList> {
    const id = randomUUID();
    const conceptList: ConceptList = {
      ...insertConceptList,
      id,
      referenceImageUrl: insertConceptList.referenceImageUrl || null,
      promptId: insertConceptList.promptId || null,
      promptText: insertConceptList.promptText || null,
      userId: insertConceptList.userId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.conceptLists.set(id, conceptList);
    return conceptList;
  }

  async updateConceptList(id: string, updates: Partial<InsertConceptList>): Promise<ConceptList | undefined> {
    const conceptList = this.conceptLists.get(id);
    if (!conceptList) return undefined;
    
    const updatedConceptList: ConceptList = {
      ...conceptList,
      ...updates,
      updatedAt: new Date()
    };
    this.conceptLists.set(id, updatedConceptList);
    return updatedConceptList;
  }

  async deleteConceptList(id: string): Promise<boolean> {
    return this.conceptLists.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: SessionStore;
  
  constructor() {
    // Initialize PostgreSQL session store - From blueprint:javascript_auth_all_persistance
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool: pool, // Use the imported pool directly
      createTableIfMissing: true 
    }) as SessionStore;
  }
  
  // User authentication methods - From blueprint:javascript_auth_all_persistance
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        role: insertUser.role as "admin" | "user" | null,
        updatedAt: new Date()
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData = { 
      ...updates, 
      updatedAt: new Date() 
    };
    if (updates.role) {
      updateData.role = updates.role as "admin" | "user" | null;
    }
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deactivateUser(id: string): Promise<User | undefined> {
    return this.updateUser(id, { isActive: false });
  }
  
  async getImageStyleById(id: string): Promise<ImageStyle | undefined> {
    const [style] = await db.select().from(imageStyles).where(eq(imageStyles.id, id));
    return style || undefined;
  }

  async getAllImageStyles(): Promise<ImageStyle[]> {
    return await db.select().from(imageStyles);
  }

  async createImageStyle(insertStyle: InsertImageStyle): Promise<ImageStyle> {
    const [style] = await db
      .insert(imageStyles)
      .values(insertStyle)
      .returning();
    return style;
  }

  async updateImageStyle(id: string, updates: Partial<InsertImageStyle>): Promise<ImageStyle | undefined> {
    const [updated] = await db
      .update(imageStyles)
      .set(updates)
      .where(eq(imageStyles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteImageStyle(id: string): Promise<boolean> {
    const result = await db.delete(imageStyles).where(eq(imageStyles.id, id));
    return (result.rowCount || 0) > 0;
  }

  async duplicateImageStyle(id: string, userId: string): Promise<ImageStyle | undefined> {
    const [originalStyle] = await db.select().from(imageStyles).where(eq(imageStyles.id, id));
    if (!originalStyle) return undefined;

    const newStyle = {
      ...originalStyle,
      id: randomUUID(),
      name: `${originalStyle.name} (Copy)`,
      createdBy: userId,
      createdAt: new Date()
    };

    const [insertedStyle] = await db.insert(imageStyles).values(newStyle).returning();
    return insertedStyle;
  }

  async getGenerationJobById(id: string): Promise<GenerationJob | undefined> {
    const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, id));
    return job || undefined;
  }

  async createGenerationJob(insertJob: InsertGenerationJob): Promise<GenerationJob> {
    const [job] = await db
      .insert(generationJobs)
      .values({
        ...insertJob,
        visualConcepts: insertJob.visualConcepts as string[]
      })
      .returning();
    return job;
  }

  async updateGenerationJob(id: string, updates: Partial<GenerationJob>): Promise<GenerationJob | undefined> {
    const [updated] = await db
      .update(generationJobs)
      .set(updates)
      .where(eq(generationJobs.id, id))
      .returning();
    return updated || undefined;
  }

  async getGeneratedImageById(id: string): Promise<GeneratedImage | undefined> {
    const [image] = await db.select().from(generatedImages).where(eq(generatedImages.id, id));
    return image || undefined;
  }

  async getGeneratedImagesByJobId(jobId: string): Promise<GeneratedImage[]> {
    return await db.select().from(generatedImages).where(eq(generatedImages.jobId, jobId));
  }

  async getGeneratedImagesBySessionId(sessionId: string): Promise<GeneratedImage[]> {
    try {
      // Use JOIN to fetch images directly - much faster than fetching jobs first
      const images = await db
        .select({
          id: generatedImages.id,
          userId: generatedImages.userId,
          jobId: generatedImages.jobId,
          sourceImageId: generatedImages.sourceImageId,
          visualConcept: generatedImages.visualConcept,
          imageUrl: generatedImages.imageUrl,
          prompt: generatedImages.prompt,
          regenerationInstruction: generatedImages.regenerationInstruction,
          status: generatedImages.status,
          createdAt: generatedImages.createdAt
        })
        .from(generatedImages)
        .innerJoin(generationJobs, eq(generatedImages.jobId, generationJobs.id))
        .where(
          and(
            eq(generationJobs.sessionId, sessionId),
            eq(generatedImages.status, 'completed')
          )
        );
      
      console.log(`Retrieved ${images.length} completed images for session ${sessionId} using JOIN`);
      return images;
    } catch (error) {
      console.error(`Error in getGeneratedImagesBySessionId for session ${sessionId}:`, error);
      throw error;
    }
  }

  async createGeneratedImage(insertImage: InsertGeneratedImage): Promise<GeneratedImage> {
    const [image] = await db
      .insert(generatedImages)
      .values(insertImage)
      .returning();
    return image;
  }

  async updateGeneratedImage(id: string, updates: Partial<GeneratedImage>): Promise<GeneratedImage | undefined> {
    const [updated] = await db
      .update(generatedImages)
      .set(updates)
      .where(eq(generatedImages.id, id))
      .returning();
    return updated || undefined;
  }

  // Project Session methods for DatabaseStorage
  async getProjectSessionById(id: string): Promise<ProjectSession | undefined> {
    const [session] = await db.select().from(projectSessions).where(eq(projectSessions.id, id));
    return session || undefined;
  }

  async getAllProjectSessions(): Promise<ProjectSession[]> {
    return await db.select().from(projectSessions).orderBy(desc(projectSessions.updatedAt));
  }

  async createProjectSession(insertSession: InsertProjectSession): Promise<ProjectSession> {
    // Ensure proper types before database insert
    const safeSession = {
      userId: insertSession.userId || null, // Include userId for proper user scoping
      name: insertSession.name || null,
      displayName: insertSession.displayName,
      styleId: insertSession.styleId || null,
      visualConcepts: Array.isArray(insertSession.visualConcepts) ? insertSession.visualConcepts as string[] : [] as string[],
      settings: insertSession.settings as GenerationSettings,
      isTemporary: Boolean(insertSession.isTemporary) || false,
      hasUnsavedChanges: Boolean(insertSession.hasUnsavedChanges) || false
    };

    const [session] = await db
      .insert(projectSessions)
      .values(safeSession)
      .returning();
    return session;
  }

  async updateProjectSession(id: string, updates: Partial<InsertProjectSession>): Promise<ProjectSession | undefined> {
    // Ensure proper types before database update
    const safeUpdates: Partial<typeof projectSessions.$inferInsert> = {};
    
    if (updates.name !== undefined) safeUpdates.name = updates.name;
    if (updates.displayName !== undefined) safeUpdates.displayName = updates.displayName;
    if (updates.styleId !== undefined) safeUpdates.styleId = updates.styleId;
    if (updates.visualConcepts !== undefined) {
      safeUpdates.visualConcepts = Array.isArray(updates.visualConcepts) ? updates.visualConcepts as string[] : [] as string[];
    }
    if (updates.settings !== undefined) {
      safeUpdates.settings = updates.settings as GenerationSettings;
    }
    if (updates.isTemporary !== undefined) {
      safeUpdates.isTemporary = Boolean(updates.isTemporary);
    }
    if (updates.hasUnsavedChanges !== undefined) {
      safeUpdates.hasUnsavedChanges = Boolean(updates.hasUnsavedChanges);
    }
    
    safeUpdates.updatedAt = new Date();

    const [updated] = await db
      .update(projectSessions)
      .set(safeUpdates)
      .where(eq(projectSessions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProjectSession(id: string): Promise<boolean> {
    const result = await db.delete(projectSessions).where(eq(projectSessions.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getTemporarySession(): Promise<ProjectSession | undefined> {
    try {
      const [session] = await db.select().from(projectSessions).where(eq(projectSessions.isTemporary, true)).limit(1);
      return session || undefined;
    } catch (error) {
      console.error('Error fetching temporary session:', error);
      return undefined;
    }
  }

  async clearTemporarySessions(): Promise<void> {
    try {
      await db.delete(projectSessions).where(eq(projectSessions.isTemporary, true));
    } catch (error) {
      console.error('Error clearing temporary sessions:', error);
    }
  }

  async getTemporarySessionsForUser(userId: string): Promise<ProjectSession[]> {
    try {
      return await db.select().from(projectSessions).where(
        and(eq(projectSessions.userId, userId), eq(projectSessions.isTemporary, true))
      );
    } catch (error) {
      console.error('Error fetching temporary sessions for user:', error);
      return [];
    }
  }

  async clearTemporarySessionsForUser(userId: string): Promise<number> {
    try {
      const result = await db.delete(projectSessions).where(
        and(eq(projectSessions.userId, userId), eq(projectSessions.isTemporary, true))
      );
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error clearing temporary sessions for user:', error);
      return 0;
    }
  }

  async migrateGenerationJobsToSession(sourceSessionId: string, targetSessionId: string): Promise<number> {
    try {
      const result = await db
        .update(generationJobs)
        .set({ sessionId: targetSessionId })
        .where(eq(generationJobs.sessionId, sourceSessionId));
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error migrating generation jobs to session:', error);
      return 0;
    }
  }

  async getWorkingSessionForUser(userId: string): Promise<ProjectSession | undefined> {
    try {
      const [session] = await db
        .select()
        .from(projectSessions)
        .where(
          and(
            eq(projectSessions.userId, userId),
            isNull(projectSessions.name),
            eq(projectSessions.isTemporary, false)
          )
        )
        .orderBy(desc(projectSessions.updatedAt))
        .limit(1);
      return session;
    } catch (error) {
      console.error('Error fetching working session for user:', error);
      return undefined;
    }
  }

  // User Preferences methods
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    try {
      const [preferences] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      return preferences;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      return undefined;
    }
  }

  async updateUserPreferences(userId: string, preferences: { defaultExtractionPrompt: string; defaultConceptPrompt: string }): Promise<UserPreferences> {
    try {
      // Check if preferences already exist
      const existing = await this.getUserPreferences(userId);
      
      if (existing) {
        // Update existing preferences
        const [updated] = await db
          .update(userPreferences)
          .set({
            defaultExtractionPrompt: preferences.defaultExtractionPrompt,
            defaultConceptPrompt: preferences.defaultConceptPrompt,
            updatedAt: new Date()
          })
          .where(eq(userPreferences.userId, userId))
          .returning();
        return updated;
      } else {
        // Create new preferences
        const [created] = await db
          .insert(userPreferences)
          .values({
            userId,
            defaultExtractionPrompt: preferences.defaultExtractionPrompt,
            defaultConceptPrompt: preferences.defaultConceptPrompt
          })
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw new Error('Failed to update user preferences');
    }
  }

  // System Prompts methods
  async getSystemPromptById(id: string): Promise<SystemPrompt | undefined> {
    try {
      const [prompt] = await db
        .select()
        .from(systemPrompts)
        .where(eq(systemPrompts.id, id))
        .limit(1);
      return prompt;
    } catch (error) {
      console.error('Error fetching system prompt:', error);
      return undefined;
    }
  }

  async getAllSystemPrompts(): Promise<SystemPrompt[]> {
    try {
      return await db.select().from(systemPrompts);
    } catch (error) {
      console.error('Error fetching all system prompts:', error);
      return [];
    }
  }

  async getSystemPromptsByCategory(category: "style_extraction" | "concept_generation"): Promise<SystemPrompt[]> {
    try {
      return await db
        .select()
        .from(systemPrompts)
        .where(eq(systemPrompts.category, category));
    } catch (error) {
      console.error('Error fetching system prompts by category:', error);
      return [];
    }
  }

  async getDefaultSystemPromptByCategory(category: "style_extraction" | "concept_generation"): Promise<SystemPrompt | undefined> {
    try {
      const [prompt] = await db
        .select()
        .from(systemPrompts)
        .where(and(eq(systemPrompts.category, category), eq(systemPrompts.isDefault, true)))
        .limit(1);
      return prompt;
    } catch (error) {
      console.error('Error fetching default system prompt:', error);
      return undefined;
    }
  }

  async createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt> {
    try {
      const [created] = await db
        .insert(systemPrompts)
        .values(prompt)
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating system prompt:', error);
      throw new Error('Failed to create system prompt');
    }
  }

  async updateSystemPrompt(id: string, updates: Partial<InsertSystemPrompt>): Promise<SystemPrompt | undefined> {
    try {
      const [updated] = await db
        .update(systemPrompts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(systemPrompts.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating system prompt:', error);
      return undefined;
    }
  }

  async deleteSystemPrompt(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(systemPrompts)
        .where(eq(systemPrompts.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting system prompt:', error);
      return false;
    }
  }

  // Media Adapter methods
  async getMediaAdapterById(id: string): Promise<MediaAdapter | undefined> {
    try {
      const [adapter] = await db
        .select()
        .from(mediaAdapters)
        .where(eq(mediaAdapters.id, id))
        .limit(1);
      return adapter;
    } catch (error) {
      console.error('Error fetching media adapter by id:', error);
      return undefined;
    }
  }

  async getAllMediaAdapters(): Promise<MediaAdapter[]> {
    try {
      return await db.select().from(mediaAdapters).orderBy(desc(mediaAdapters.createdAt));
    } catch (error) {
      console.error('Error fetching all media adapters:', error);
      return [];
    }
  }

  async getDefaultMediaAdapter(): Promise<MediaAdapter | undefined> {
    try {
      const [adapter] = await db
        .select()
        .from(mediaAdapters)
        .where(eq(mediaAdapters.isDefault, true))
        .limit(1);
      return adapter;
    } catch (error) {
      console.error('Error fetching default media adapter:', error);
      return undefined;
    }
  }

  async createMediaAdapter(adapter: InsertMediaAdapter): Promise<MediaAdapter> {
    try {
      // If setting as default, unset all other defaults first
      if (adapter.isDefault) {
        await db
          .update(mediaAdapters)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(mediaAdapters.isDefault, true));
      }
      
      const [created] = await db
        .insert(mediaAdapters)
        .values(adapter)
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating media adapter:', error);
      throw new Error('Failed to create media adapter');
    }
  }

  async updateMediaAdapter(id: string, updates: Partial<InsertMediaAdapter>): Promise<MediaAdapter | undefined> {
    try {
      // If setting as default, unset all other defaults first
      if (updates.isDefault === true) {
        await db
          .update(mediaAdapters)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(mediaAdapters.isDefault, true), ne(mediaAdapters.id, id)));
      }
      
      const [updated] = await db
        .update(mediaAdapters)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(mediaAdapters.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating media adapter:', error);
      return undefined;
    }
  }

  async deleteMediaAdapter(id: string): Promise<boolean> {
    try {
      await db
        .delete(mediaAdapters)
        .where(eq(mediaAdapters.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting media adapter:', error);
      return false;
    }
  }

  async getConceptListById(id: string): Promise<ConceptList | undefined> {
    try {
      const [conceptList] = await db
        .select()
        .from(conceptLists)
        .where(eq(conceptLists.id, id))
        .limit(1);
      return conceptList;
    } catch (error) {
      console.error('Error fetching concept list by id:', error);
      return undefined;
    }
  }

  async getAllConceptLists(): Promise<ConceptList[]> {
    try {
      return await db.select().from(conceptLists).orderBy(desc(conceptLists.createdAt));
    } catch (error) {
      console.error('Error fetching all concept lists:', error);
      return [];
    }
  }

  async createConceptList(conceptList: InsertConceptList): Promise<ConceptList> {
    try {
      const [created] = await db
        .insert(conceptLists)
        .values(conceptList)
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating concept list:', error);
      throw new Error('Failed to create concept list');
    }
  }

  async updateConceptList(id: string, updates: Partial<InsertConceptList>): Promise<ConceptList | undefined> {
    try {
      const [updated] = await db
        .update(conceptLists)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(conceptLists.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating concept list:', error);
      return undefined;
    }
  }

  async deleteConceptList(id: string): Promise<boolean> {
    try {
      await db
        .delete(conceptLists)
        .where(eq(conceptLists.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting concept list:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();

// Initialize with some default styles and test user for demo purposes
(async () => {
  const defaultStyles = [
    {
      name: 'Professional Corporate',
      stylePrompt: 'professional corporate style, clean modern design, business presentation quality, high-end commercial photography',
      aiStyleData: {
        description: 'Clean, modern corporate style for business presentations',
        mood: 'professional and trustworthy'
      }
    },
    {
      name: 'Creative Artistic',
      stylePrompt: 'creative artistic style, vibrant colors, bold design elements, contemporary art inspiration, dynamic composition',
      aiStyleData: {
        description: 'Bold artistic style with vibrant colors and creative elements',
        mood: 'energetic and expressive'
      }
    },
    {
      name: 'Minimalist Clean',
      stylePrompt: 'minimalist clean style, simple design, plenty of white space, elegant simplicity, modern minimal aesthetic',
      aiStyleData: {
        description: 'Simple, clean minimalist aesthetic with plenty of white space',
        mood: 'serene and refined'
      }
    },
    {
      name: 'Vintage Retro',
      stylePrompt: 'vintage retro style, nostalgic aesthetic, classic design elements, retro color palette, timeless appeal',
      aiStyleData: {
        description: 'Nostalgic vintage style with retro color palettes and classic design elements',
        mood: 'nostalgic and warm'
      }
    }
  ];

  // Add default styles if storage is empty
  const existingStyles = await storage.getAllImageStyles();
  if (existingStyles.length === 0) {
    for (const style of defaultStyles) {
      await storage.createImageStyle(style);
    }
    console.log('Initialized storage with default image styles');
  }

  // Seed initial media adapters
  const existingAdapters = await storage.getAllMediaAdapters();
  if (existingAdapters.length === 0) {
    const mediaAdaptersSeed = [
      {
        name: 'Photography',
        description: 'Professional photography with realistic lighting, depth of field, and camera-specific characteristics',
        vocabularyAdjustments: 'Use photography-specific terms: aperture, bokeh, depth of field, exposure, ISO, shutter speed, lens characteristics, focal length. Avoid illustration terms like "illustration", "drawn", "painted".',
        lightingAdjustments: 'Describe natural and artificial light sources with photographic precision. Specify lighting ratios, key/fill/rim light placement, golden hour qualities, studio lighting setups. Reference real-world lighting conditions.',
        surfaceAdjustments: 'Focus on physically accurate material properties: reflectivity, translucency, texture detail captured by camera sensors. Describe how materials interact with light in realistic ways (subsurface scattering, specular highlights, diffuse reflection).',
        conceptualAdjustments: 'Generate concepts that work as real-world photography subjects. Consider camera angles, composition rules (rule of thirds, leading lines), and what can actually be photographed or staged.',
        isDefault: true
      },
      {
        name: 'Illustration',
        description: 'Digital or traditional illustration with artistic interpretation, stylization, and design flexibility',
        vocabularyAdjustments: 'Use illustration and art terms: brushstrokes, linework, stylized, artistic interpretation, digital painting, hand-drawn. Embrace non-photorealistic descriptors. Avoid photography-specific technical terms.',
        lightingAdjustments: 'Describe lighting as artistic choices rather than physical accuracy. Use terms like "dramatic shadow shapes", "cel-shaded", "painterly light", "graphic contrast". Lighting can be stylized, impossible, or symbolic.',
        surfaceAdjustments: 'Focus on artistic rendering techniques: flat colors, gradient fills, texture overlays, pattern work, line art definition. Surfaces can be simplified, exaggerated, or abstracted for visual impact.',
        conceptualAdjustments: 'Generate concepts that leverage illustration freedoms: impossible perspectives, symbolic representations, exaggerated proportions, fantastical elements. Think in terms of visual metaphors and graphic storytelling.',
        isDefault: false
      },
      {
        name: '3D Render',
        description: 'Computer-generated 3D imagery with precise geometric control, perfect lighting, and material rendering',
        vocabularyAdjustments: 'Use 3D rendering terms: ray tracing, PBR materials, mesh, topology, global illumination, HDRI lighting, normal maps, subsurface scattering. Reference render engines (Arnold, V-Ray, Cycles) when relevant.',
        lightingAdjustments: 'Describe technical lighting setups: HDRI environments, three-point lighting rigs, area lights, IES profiles. Specify rendering techniques like path tracing, caustics, ambient occlusion. Embrace perfect, controlled lighting impossible in photography.',
        surfaceAdjustments: 'Focus on shader properties: metallic/roughness values, IOR (index of refraction), normal/bump mapping, displacement. Describe materials with technical precision (0.8 metallic, 0.2 roughness, 1.5 IOR).',
        conceptualAdjustments: 'Generate concepts optimized for 3D creation: clean geometric forms, product shots, architectural visualization, impossible objects, perfectly clean environments. Consider what benefits from 3D precision and control.',
        isDefault: false
      },
      {
        name: 'Product/UI Design',
        description: 'Clean, professional product and interface design with emphasis on clarity, usability, and modern aesthetics',
        vocabularyAdjustments: 'Use design and UX terms: UI elements, product shots, clean backgrounds, professional presentation, marketing imagery. Focus on clarity and visual hierarchy. Avoid artistic or abstract descriptors.',
        lightingAdjustments: 'Describe clean, even lighting that showcases products clearly. Studio lighting, soft shadows, minimal drama, white/gradient backgrounds. Lighting should enhance visibility and appeal without dominating the composition.',
        surfaceAdjustments: 'Focus on pristine, perfect surfaces: clean materials, subtle reflections, professional finish. Products should appear flawless. UI elements should be crisp with clean edges and modern glass/metal effects.',
        conceptualAdjustments: 'Generate concepts for product marketing and UI presentations: hero shots, feature highlights, app interfaces, product comparisons, lifestyle contexts. Think e-commerce and marketing materials.',
        isDefault: false
      }
    ];

    for (const adapter of mediaAdaptersSeed) {
      await storage.createMediaAdapter(adapter);
    }
    console.log('Initialized storage with default media adapters');
  }

  // Create test users for login
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    // Import crypto for password hashing
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    
    // Create test user
    const testSalt = randomBytes(16).toString("hex");
    const testBuf = (await scryptAsync('password123', testSalt, 64)) as Buffer;
    const testHashedPassword = `${testBuf.toString("hex")}.${testSalt}`;
    
    await storage.createUser({
      email: 'test@example.com',
      password: testHashedPassword,
      role: 'user'
    });
    console.log('Created test user: test@example.com / password123');
    
    // Create admin user
    const adminSalt = randomBytes(16).toString("hex");
    const adminBuf = (await scryptAsync('admin123', adminSalt, 64)) as Buffer;
    const adminHashedPassword = `${adminBuf.toString("hex")}.${adminSalt}`;
    
    await storage.createUser({
      email: 'admin@example.com',
      password: adminHashedPassword,
      role: 'admin'
    });
    console.log('Created admin user: admin@example.com / admin123');
  }
})();
