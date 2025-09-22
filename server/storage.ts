import { type ImageStyle, type InsertImageStyle, type GenerationJob, type InsertGenerationJob, type GeneratedImage, type InsertGeneratedImage, type GenerationSettings, imageStyles, generationJobs, generatedImages } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
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
  createGeneratedImage(image: InsertGeneratedImage): Promise<GeneratedImage>;
  updateGeneratedImage(id: string, updates: Partial<GeneratedImage>): Promise<GeneratedImage | undefined>;
}

export class MemStorage implements IStorage {
  private imageStyles: Map<string, ImageStyle>;
  private generationJobs: Map<string, GenerationJob>;
  private generatedImages: Map<string, GeneratedImage>;

  constructor() {
    this.imageStyles = new Map();
    this.generationJobs = new Map();
    this.generatedImages = new Map();
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
      createdAt: new Date() 
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
      status: 'pending',
      progress: 0,
      styleId: insertJob.styleId || null,
      visualConcepts: Array.isArray(insertJob.visualConcepts) ? insertJob.visualConcepts as string[] : [],
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

  async createGeneratedImage(insertImage: InsertGeneratedImage): Promise<GeneratedImage> {
    const id = randomUUID();
    const image: GeneratedImage = {
      id,
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
    
    const updatedImage = { ...image, ...updates };
    this.generatedImages.set(id, updatedImage);
    return updatedImage;
  }

  async updateImageStyle(id: string, updates: Partial<InsertImageStyle>): Promise<ImageStyle | undefined> {
    const style = this.imageStyles.get(id);
    if (!style) return undefined;
    
    const updatedStyle = { ...style, ...updates };
    this.imageStyles.set(id, updatedStyle);
    return updatedStyle;
  }

  async deleteImageStyle(id: string): Promise<boolean> {
    return this.imageStyles.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
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
}

export const storage = new DatabaseStorage();

// Initialize with some default styles for demo purposes
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
})();
