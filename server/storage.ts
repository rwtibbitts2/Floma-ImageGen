import { type ImageStyle, type InsertImageStyle, type GenerationJob, type InsertGenerationJob, type GeneratedImage, type InsertGeneratedImage, type GenerationSettings } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Image Style management
  getImageStyleById(id: string): Promise<ImageStyle | undefined>;
  getAllImageStyles(): Promise<ImageStyle[]>;
  createImageStyle(style: InsertImageStyle): Promise<ImageStyle>;
  
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
}

export const storage = new MemStorage();

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
