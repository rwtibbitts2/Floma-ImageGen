import { type ImageStyle, type InsertImageStyle, type GenerationJob, type InsertGenerationJob, type GeneratedImage, type InsertGeneratedImage, type ProjectSession, type InsertProjectSession, type GenerationSettings, type User, type InsertUser, imageStyles, generationJobs, generatedImages, projectSessions, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, inArray, and, isNull } from "drizzle-orm";
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
}

export class MemStorage implements IStorage {
  private imageStyles: Map<string, ImageStyle>;
  private generationJobs: Map<string, GenerationJob>;
  private generatedImages: Map<string, GeneratedImage>;
  private projectSessions: Map<string, ProjectSession>;
  private users: Map<string, User>;
  sessionStore: SessionStore;

  constructor() {
    this.imageStyles = new Map();
    this.generationJobs = new Map();
    this.generatedImages = new Map();
    this.projectSessions = new Map();
    this.users = new Map();
    
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
      description: insertStyle.description || null,
      id, 
      createdAt: new Date(),
      createdBy: insertStyle.createdBy || null // Actually use the provided createdBy value
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
    
    // Return all images that belong to any of these jobs
    return Array.from(this.generatedImages.values()).filter(
      (image) => jobIds.has(image.jobId)
    );
  }

  async createGeneratedImage(insertImage: InsertGeneratedImage): Promise<GeneratedImage> {
    const id = randomUUID();
    const image: GeneratedImage = {
      id,
      userId: insertImage.userId || null, // Actually use the provided userId value
      jobId: insertImage.jobId || null,
      visualConcept: insertImage.visualConcept,
      imageUrl: insertImage.imageUrl,
      prompt: insertImage.prompt,
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
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;
  
  constructor() {
    // Initialize PostgreSQL session store - From blueprint:javascript_auth_all_persistance
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool: (db as any).pool, // Access the underlying pool
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
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
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

  async getGenerationJobById(id: string): Promise<GenerationJob | undefined> {
    const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, id));
    return job || undefined;
  }

  async createGenerationJob(insertJob: InsertGenerationJob): Promise<GenerationJob> {
    const [job] = await db
      .insert(generationJobs)
      .values(insertJob)
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
    // First get all jobs for this session
    const sessionJobIds = await db
      .select({ id: generationJobs.id })
      .from(generationJobs)
      .where(eq(generationJobs.sessionId, sessionId));
    
    if (sessionJobIds.length === 0) {
      return [];
    }
    
    // Then get all images for these jobs
    const jobIds = sessionJobIds.map(job => job.id);
    return await db.select().from(generatedImages).where(
      inArray(generatedImages.jobId, jobIds)
    );
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
      visualConcepts: Array.isArray(insertSession.visualConcepts) ? insertSession.visualConcepts : [],
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
      safeUpdates.visualConcepts = Array.isArray(updates.visualConcepts) ? updates.visualConcepts : [];
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
}

export const storage = new DatabaseStorage();

// Initialize with some default styles and test user for demo purposes
(async () => {
  const defaultStyles = [
    {
      name: 'Professional Corporate',
      description: 'Clean, modern corporate style for business presentations',
      stylePrompt: 'professional corporate style, clean modern design, business presentation quality, high-end commercial photography'
    },
    {
      name: 'Creative Artistic',
      description: 'Bold artistic style with vibrant colors and creative elements',
      stylePrompt: 'creative artistic style, vibrant colors, bold design elements, contemporary art inspiration, dynamic composition'
    },
    {
      name: 'Minimalist Clean',
      description: 'Simple, clean minimalist aesthetic with plenty of white space',
      stylePrompt: 'minimalist clean style, simple design, plenty of white space, elegant simplicity, modern minimal aesthetic'
    },
    {
      name: 'Vintage Retro',
      description: 'Nostalgic vintage style with retro color palettes and classic design elements',
      stylePrompt: 'vintage retro style, nostalgic aesthetic, classic design elements, retro color palette, timeless appeal'
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

  // Create test user for login
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    // Import crypto for password hashing
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    
    // Hash the password properly
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync('password123', salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;
    
    await storage.createUser({
      email: 'test@example.com',
      password: hashedPassword,
      role: 'user'
    });
    console.log('Created test user: test@example.com / password123');
  }
})();
