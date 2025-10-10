import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from 'express';
import { insertImageStyleSchema, insertGenerationJobSchema, insertGeneratedImageSchema, insertSystemPromptSchema, InsertConceptList, GenerationSettings, generationSettingsSchema, Concept } from '@shared/schema';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import OpenAI, { toFile } from 'openai';
import { nanoid } from 'nanoid';
import { setupAuth, requireAuth } from './auth'; // From blueprint:javascript_auth_all_persistance
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import sharp from 'sharp';
import multer, { type FileFilterCallback } from 'multer';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { buildStyleDescription } from '@shared/utils';

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({ 
  dest: 'temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Define model capabilities for validation
interface ModelCapability {
  supportsQuality: boolean;
  supportedSizes: string[];
  supportsEditing: boolean;
}

const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'dall-e-2': {
    supportsQuality: false,
    supportedSizes: ['1024x1024'],
    supportsEditing: true
  },
  'dall-e-3': {
    supportsQuality: true, 
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportsEditing: false
  },
  'gpt-image-1': {
    supportsQuality: true,
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportsEditing: true
  }
};

// Helper function to build OpenAI request parameters with model-specific validation
function buildImageParams(model: string, size: string, quality: string, prompt: string, transparency?: boolean): any {
  const capability = MODEL_CAPABILITIES[model];
  if (!capability) {
    throw new Error(`Unsupported model: ${model}`);
  }
  
  // Validate and coerce size
  if (!capability.supportedSizes.includes(size)) {
    throw new Error(`Model ${model} does not support size ${size}. Supported sizes: ${capability.supportedSizes.join(', ')}`);
  }
  
  // Build base parameters
  const params: any = {
    model: model,
    prompt: prompt,
    n: 1,
    size: size
  };
  
  // Add quality only if supported with correct mapping per model
  if (capability.supportsQuality) {
    if (quality === 'hd') {
      if (model === 'dall-e-3') {
        params.quality = 'hd';
      } else if (model === 'gpt-image-1') {
        params.quality = 'high';
      }
    } else {
      // Standard quality mapping per model
      if (model === 'dall-e-3') {
        params.quality = 'standard';
      } else if (model === 'gpt-image-1') {
        params.quality = 'medium'; // GPT Image 1 uses 'medium' instead of 'standard'
      }
    }
  }
  
  // Add transparency support (only gpt-image-1 supports true transparency)
  if (transparency) {
    if (model === 'gpt-image-1') {
      params.background = 'transparent'; // Request transparent background
    } else {
      // For models that don't support transparency, we can't fulfill the request
      console.warn(`Transparency requested but model ${model} does not support it. Use gpt-image-1 for transparency.`);
    }
  }
  
  return params;
}

// Helper function to convert JSON concept to rich descriptive text
// Includes ALL fields from the JSON to preserve complete concept information
function convertConceptJsonToText(conceptJson: string): string {
  try {
    const parsed = JSON.parse(conceptJson);
    
    // NEW FORMAT: Handle concepts array format
    if (parsed.concepts && Array.isArray(parsed.concepts) && parsed.concepts.length > 0) {
      // Randomly pick one concept from the array
      const randomIndex = Math.floor(Math.random() * parsed.concepts.length);
      const selectedConcept = parsed.concepts[randomIndex];
      console.log(`Selected concept ${randomIndex + 1}/${parsed.concepts.length}:`, selectedConcept);
      return selectedConcept;
    }
    
    // LEGACY FORMAT: Handle old structured JSON format
    const parts: string[] = [];
    
    // Process ALL fields in a structured order for natural language
    
    // Core subject/description (most important)
    if (parsed.subject) {
      parts.push(parsed.subject);
    } else if (parsed.description) {
      parts.push(parsed.description);
    } else if (parsed.message) {
      parts.push(parsed.message);
    }
    
    // Title (if not redundant with subject)
    if (parsed.title && !parts.some(p => p.includes(parsed.title))) {
      parts.push(`Theme: ${parsed.title}`);
    }
    
    // Metaphor (if present and not already mentioned)
    if (parsed.metaphor && !parts.some(p => p.toLowerCase().includes(parsed.metaphor.toLowerCase()))) {
      parts.push(`Visual metaphor: ${parsed.metaphor}`);
    }
    
    // Composition details
    if (parsed.composition) {
      const comp = parsed.composition;
      const compParts: string[] = [];
      if (comp.shot) compParts.push(comp.shot + ' shot');
      if (comp.angle) compParts.push(comp.angle + ' angle');
      if (comp.focal_point) compParts.push('focal point: ' + comp.focal_point);
      if (comp.framing) compParts.push('framing: ' + comp.framing);
      if (comp.depth) compParts.push('depth: ' + comp.depth);
      if (compParts.length > 0) {
        parts.push('Composition - ' + compParts.join(', '));
      }
    }
    
    // Constraints
    if (parsed.constraints) {
      if (parsed.constraints.include && Array.isArray(parsed.constraints.include)) {
        parts.push('Must include: ' + parsed.constraints.include.join(', '));
      }
      if (parsed.constraints.avoid && Array.isArray(parsed.constraints.avoid)) {
        parts.push('Must avoid: ' + parsed.constraints.avoid.join(', '));
      }
      if (parsed.constraints.required_elements) {
        parts.push('Required elements: ' + parsed.constraints.required_elements);
      }
    }
    
    // Any other top-level fields not already processed
    const processedKeys = new Set(['subject', 'description', 'message', 'title', 'metaphor', 'composition', 'constraints', 'concept_version']);
    for (const [key, value] of Object.entries(parsed)) {
      if (!processedKeys.has(key) && value) {
        if (typeof value === 'string') {
          parts.push(`${key.replace(/_/g, ' ')}: ${value}`);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          // Handle nested objects
          const objParts = Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
          parts.push(`${key.replace(/_/g, ' ')}: ${objParts}`);
        } else if (Array.isArray(value)) {
          parts.push(`${key.replace(/_/g, ' ')}: ${value.join(', ')}`);
        }
      }
    }
    
    return parts.length > 0 ? parts.join('. ') : conceptJson;
  } catch (error) {
    // If not valid JSON or parsing fails, return as-is
    return conceptJson;
  }
}


// Utility function to download image from URL to temporary file
async function downloadImageToTempFile(imageUrl: string): Promise<{ path: string; contentType: string; }> {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Handle data URLs (base64 encoded images from GPT Image 1)
    if (imageUrl.startsWith('data:')) {
      try {
        console.log('Processing data URL for regeneration');
        
        // Parse data URL: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          reject(new Error('Invalid data URL format'));
          return;
        }
        
        const [, mimeType, base64Data] = matches;
        
        // Determine file extension from MIME type
        let fileExtension = '.png'; // default fallback
        let validatedContentType = 'image/png'; // default fallback
        
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
          fileExtension = '.jpg';
          validatedContentType = 'image/jpeg';
        } else if (mimeType === 'image/png') {
          fileExtension = '.png';
          validatedContentType = 'image/png';
        } else if (mimeType === 'image/webp') {
          fileExtension = '.webp';
          validatedContentType = 'image/webp';
        } else {
          reject(new Error(`Unsupported MIME type in data URL: ${mimeType}`));
          return;
        }
        
        // Decode base64 data and save to file
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const tempFileName = `temp_image_${nanoid()}${fileExtension}`;
        const tempFilePath = path.join(tempDir, tempFileName);
        
        fs.writeFileSync(tempFilePath, imageBuffer);
        console.log(`Data URL image saved as: ${fileExtension} (${imageBuffer.length} bytes)`);
        resolve({ path: tempFilePath, contentType: validatedContentType });
        
      } catch (error) {
        reject(new Error(`Failed to process data URL: ${error}`));
      }
      return;
    }
    
    // Handle regular HTTP/HTTPS URLs
    const protocol = imageUrl.startsWith('https:') ? https : http;
    
    protocol.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      // Determine proper file extension and validate Content-Type
      const contentType = response.headers['content-type'] || '';
      let fileExtension = '.png'; // default fallback
      let validatedContentType = 'image/png'; // default fallback
      
      if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
        fileExtension = '.jpg';
        validatedContentType = 'image/jpeg';
      } else if (contentType.includes('image/png')) {
        fileExtension = '.png';
        validatedContentType = 'image/png';
      } else if (contentType.includes('image/webp')) {
        fileExtension = '.webp';
        validatedContentType = 'image/webp';
      } else if (contentType && !contentType.includes('image/')) {
        reject(new Error(`Unsupported content type: ${contentType}. Only image/jpeg, image/png, and image/webp are supported.`));
        return;
      }
      
      const tempFileName = `temp_image_${nanoid()}${fileExtension}`;
      const tempFilePath = path.join(tempDir, tempFileName);
      const file = fs.createWriteStream(tempFilePath);
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Image downloaded with Content-Type: ${contentType}, saved as: ${fileExtension}`);
        resolve({ path: tempFilePath, contentType: validatedContentType });
      });
      
      file.on('error', (err) => {
        fs.unlink(tempFilePath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Utility function to clean up temporary files
function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up temp file:', error);
  }
}

// GET /api/styles - Get image styles for authenticated user (Protected)
router.get('/styles', requireAuth, async (req, res) => {
  try {
    const styles = await storage.getAllImageStyles();
    // Filter styles to only include user's own styles (or all if admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    const filteredStyles = styles.filter(style => 
      isAdmin || 
      style.createdBy === userId || 
      !style.createdBy || 
      style.createdBy === ''
    );
    res.json(filteredStyles);
  } catch (error) {
    console.error('Error fetching styles:', error);
    res.status(500).json({ error: 'Failed to fetch styles' });
  }
});

// GET /api/styles/:id - Get a specific image style by ID (Protected)
router.get('/styles/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const style = await storage.getImageStyleById(id);
    
    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }
    
    // Verify ownership or admin access for private styles
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && style.createdBy && style.createdBy !== userId) {
      return res.status(403).json({ error: 'Access denied: not your style' });
    }
    
    res.json(style);
  } catch (error) {
    console.error('Error fetching style:', error);
    res.status(500).json({ error: 'Failed to fetch style' });
  }
});

// POST /api/styles - Create a new image style (Protected)
router.post('/styles', requireAuth, async (req, res) => {
  try {
    const validation = insertImageStyleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const style = await storage.createImageStyle({
      ...validation.data,
      createdBy: (req as any).user.id // Scope to authenticated user
    });
    res.status(201).json(style);
  } catch (error) {
    console.error('Error creating style:', error);
    res.status(500).json({ error: 'Failed to create style' });
  }
});

// PUT /api/styles/:id - Update an existing image style (Protected)
router.put('/styles/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const validation = insertImageStyleSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    // First check if style exists and verify ownership
    const existingStyle = await storage.getImageStyleById(id);
    if (!existingStyle) {
      return res.status(404).json({ error: 'Style not found' });
    }
    
    // Verify ownership (user owns style or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && existingStyle.createdBy !== userId) {
      return res.status(403).json({ error: 'Access denied: not your style' });
    }

    // Strip createdBy from update to prevent ownership tampering
    const { createdBy, ...safeUpdates } = validation.data;
    const updatedStyle = await storage.updateImageStyle(id, safeUpdates);
    
    res.json(updatedStyle);
  } catch (error) {
    console.error('Error updating style:', error);
    res.status(500).json({ error: 'Failed to update style' });
  }
});

// DELETE /api/styles/:id - Delete an image style (Protected)
router.delete('/styles/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if style exists and verify ownership
    const existingStyle = await storage.getImageStyleById(id);
    if (!existingStyle) {
      return res.status(404).json({ error: 'Style not found' });
    }
    
    // Verify ownership (user owns style or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && existingStyle.createdBy !== userId) {
      return res.status(403).json({ error: 'Access denied: not your style' });
    }
    
    const deleted = await storage.deleteImageStyle(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting style:', error);
    res.status(500).json({ error: 'Failed to delete style' });
  }
});

// POST /api/styles/:id/duplicate - Duplicate an image style (Protected)
router.post('/styles/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    
    // Check if original style exists
    const originalStyle = await storage.getImageStyleById(id);
    if (!originalStyle) {
      return res.status(404).json({ error: 'Style not found' });
    }
    
    // Duplicate the style
    const duplicatedStyle = await storage.duplicateImageStyle(id, userId);
    if (!duplicatedStyle) {
      return res.status(500).json({ error: 'Failed to duplicate style' });
    }
    
    res.status(201).json(duplicatedStyle);
  } catch (error) {
    console.error('Error duplicating style:', error);
    res.status(500).json({ error: 'Failed to duplicate style' });
  }
});

// POST /api/generate - Start image generation job (Protected)
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      jobName: z.string().min(1),
      styleId: z.string(),
      concepts: z.array(z.string()).min(1),
      settings: z.object({
        model: z.enum(['dall-e-2', 'dall-e-3', 'gpt-image-1']).default('gpt-image-1'),
        quality: z.enum(['standard', 'hd']),
        size: z.enum(['1024x1024', '1536x1024', '1024x1536']),
        variations: z.number().min(1).max(10),
        transparency: z.boolean().optional()
      }),
      sessionId: z.string().optional() // Optional sessionId for image persistence
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { jobName, styleId, concepts, settings, sessionId } = validation.data;

    // Validate model capabilities before processing
    const capability = MODEL_CAPABILITIES[settings.model];
    if (!capability) {
      return res.status(400).json({ 
        error: `Unsupported model: ${settings.model}` 
      });
    }
    
    if (!capability.supportedSizes.includes(settings.size)) {
      return res.status(400).json({ 
        error: `Model ${settings.model} does not support size ${settings.size}`,
        details: `Supported sizes for ${settings.model}: ${capability.supportedSizes.join(', ')}`
      });
    }
    
    // Validate quality parameter
    if (!capability.supportsQuality && settings.quality === 'hd') {
      return res.status(400).json({ 
        error: `Model ${settings.model} does not support HD quality`,
        details: `${settings.model} only supports standard quality. Please select standard quality.`
      });
    }

    // Get the selected style
    const style = await storage.getImageStyleById(styleId);
    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }

    // Create generation job scoped to authenticated user
    const job = await storage.createGenerationJob({
      name: jobName,
      userId: (req as any).user.id, // Scope to authenticated user
      sessionId: sessionId, // Link job to session for image persistence
      styleId: styleId,
      visualConcepts: concepts,
      settings: settings as GenerationSettings
    });
    
    // Update job to running status
    await storage.updateGenerationJob(job.id, { status: 'running' });

    // Start generation process asynchronously
    generateImagesAsync(job.id, style, concepts, settings);

    res.status(201).json({ 
      jobId: job.id,
      message: 'Generation started'
    });
  } catch (error) {
    console.error('Error starting generation:', error);
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

// POST /api/regenerate - Regenerate an image with modifications (Protected)
router.post('/regenerate', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      sourceImageId: z.string(),
      instruction: z.string().min(1).optional(), // Made optional when settings are provided
      sessionId: z.string().optional(), // Optional sessionId for image persistence
      settings: generationSettingsSchema.optional(), // Optional settings for enhancement
      useOriginalAsReference: z.boolean().default(true) // Whether to use original image as reference
    });

    // Additional validation: either instruction or settings must be provided
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { sourceImageId, instruction, sessionId, settings, useOriginalAsReference } = validation.data;

    // Ensure at least instruction or settings are provided
    if (!instruction && !settings) {
      return res.status(400).json({ 
        error: 'Either instruction or settings must be provided for regeneration'
      });
    }


    // Get the source image and verify ownership
    const sourceImage = await storage.getGeneratedImageById(sourceImageId);
    if (!sourceImage) {
      return res.status(404).json({ error: 'Source image not found' });
    }

    // Verify ownership (user owns image or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && sourceImage.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: not your image' });
    }

    // Get the source image's job to inherit style and settings
    const sourceJob = await storage.getGenerationJobById(sourceImage.jobId!);
    if (!sourceJob) {
      return res.status(404).json({ error: 'Source job not found' });
    }

    // Get the style for regeneration
    const style = await storage.getImageStyleById(sourceJob.styleId!);
    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }

    // Determine the final settings to use (provided settings or inherited from source)
    const finalSettings = settings || sourceJob.settings;

    // Validate model capabilities (same as /api/generate)
    const targetModel = finalSettings.model;
    const capability = MODEL_CAPABILITIES[targetModel];
    
    if (!targetModel || !capability) {
      return res.status(400).json({ 
        error: `Unsupported model: ${targetModel}` 
      });
    }
    
    // Only check editing capability if using original as reference
    if (useOriginalAsReference && !capability.supportsEditing) {
      const modelText = targetModel ? `"${targetModel}"` : 'from the settings (likely DALL-E 3)';
      return res.status(400).json({ 
        error: 'Model not supported for image editing', 
        details: `The model ${modelText} does not support image editing. Only DALL-E 2 and GPT Image 1 support editing with original reference. Please choose a model that supports editing or uncheck "Use original image as reference".`
      });
    }
    
    if (!capability.supportedSizes.includes(finalSettings.size)) {
      return res.status(400).json({ 
        error: `Model ${targetModel} does not support size ${finalSettings.size}`,
        details: `Supported sizes for ${targetModel}: ${capability.supportedSizes.join(', ')}`
      });
    }
    
    // Validate quality parameter
    if (!capability.supportsQuality && finalSettings.quality === 'hd') {
      return res.status(400).json({ 
        error: `Model ${targetModel} does not support HD quality`,
        details: `${targetModel} only supports standard quality. Please select standard quality.`
      });
    }

    // Create job name and concept based on what's being changed and regeneration mode
    let jobName: string;
    let modifiedConcept: string;
    
    const modePrefix = useOriginalAsReference ? "Edit" : "Regen";
    
    if (instruction && settings) {
      // Both instruction and settings provided
      modifiedConcept = `${sourceImage.visualConcept} (${instruction})`;
      jobName = `${modePrefix}: ${modifiedConcept}`;
    } else if (instruction) {
      // Only instruction provided
      modifiedConcept = `${sourceImage.visualConcept} (${instruction})`;
      jobName = `${modePrefix}: ${modifiedConcept}`;
    } else {
      // Only settings provided (enhancement)
      modifiedConcept = sourceImage.visualConcept;
      const settingsDesc = useOriginalAsReference ? "Enhancement" : "Settings Update";
      jobName = `${settingsDesc}: ${modifiedConcept}`;
    }

    const job = await storage.createGenerationJob({
      name: jobName,
      userId: userId,
      sessionId: sessionId || sourceJob.sessionId, // Use provided sessionId or inherit from source
      styleId: sourceJob.styleId!,
      visualConcepts: [modifiedConcept],
      settings: finalSettings
    });
    
    // Update job to running status
    await storage.updateGenerationJob(job.id, { status: 'running' });

    // Start regeneration process asynchronously, passing source image info and reference mode
    if (useOriginalAsReference) {
      // Image editing mode - modify the original image
      generateRegeneratedImagesAsync(job.id, style, sourceImage, instruction || '', finalSettings);
    } else {
      // Clean generation mode - generate new image from original prompt
      const originalConcept = sourceImage.visualConcept;
      const conceptWithInstruction = instruction ? `${originalConcept} (${instruction})` : originalConcept;
      generateImagesAsync(job.id, style, [conceptWithInstruction], finalSettings);
    }

    res.status(201).json({ 
      jobId: job.id,
      message: 'Regeneration started',
      modifiedConcept: modifiedConcept
    });
  } catch (error) {
    console.error('Error starting regeneration:', error);
    res.status(500).json({ error: 'Failed to start regeneration' });
  }
});

// GET /api/jobs/:id - Get generation job status for authenticated user (Protected)
router.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const job = await storage.getGenerationJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Verify ownership (user owns job or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && job.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: not your job' });
    }
    
    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// GET /api/jobs/:id/images - Get generated images for job (authenticated user only) (Protected)
router.get('/jobs/:id/images', requireAuth, async (req, res) => {
  try {
    // First verify user owns the job
    const job = await storage.getGenerationJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Verify ownership (user owns job or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && job.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: not your job' });
    }
    
    const images = await storage.getGeneratedImagesByJobId(req.params.id);
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Async function to generate images using OpenAI
async function generateImagesAsync(
  jobId: string, 
  style: any, 
  concepts: string[], 
  settings: any
) {
  try {
    const totalImages = concepts.length * settings.variations;
    let completedImages = 0;
    let failedImages = 0;

    for (const concept of concepts) {
      for (let variation = 1; variation <= settings.variations; variation++) {
        try {
          // Truncate style prompt if too long to fit within OpenAI's 1000 character limit
          const maxPromptLength = 1000;
          const templateText = `Generate a clean, professional digital asset:\nStyle: \nSubject: ${concept}`;
          const remainingSpace = maxPromptLength - templateText.length;
          
          let truncatedStylePrompt = style.stylePrompt;
          if (style.stylePrompt.length > remainingSpace) {
            truncatedStylePrompt = style.stylePrompt.substring(0, remainingSpace - 3) + '...';
            console.log(`Style prompt truncated from ${style.stylePrompt.length} to ${truncatedStylePrompt.length} characters`);
          }
          
          // Construct professional structured prompt with clear labeling
          let fullPrompt = `Generate a clean, professional digital asset:
Style: ${truncatedStylePrompt}
Subject: ${concept}`;
          
          // Add transparent background instruction when transparency is enabled
          if (settings.transparency && settings.model === 'gpt-image-1') {
            fullPrompt += `\nRender only the image subject on a transparent background`;
          }
          
          console.log(`Generating image ${completedImages + 1}/${totalImages}: "${fullPrompt}" (${fullPrompt.length} chars)`);

          const model = settings.model || "gpt-image-1";
          
          // Build request params with model-specific validation and transparency setting
          const requestParams = buildImageParams(model, settings.size, settings.quality, fullPrompt, settings.transparency);
          
          // Generate image using OpenAI
          const response = await openai.images.generate(requestParams);

          // Handle both URL and base64 image formats
          let imageUrl = response.data?.[0]?.url;
          const base64Data = response.data?.[0]?.b64_json;
          
          if (!imageUrl && base64Data) {
            // GPT Image 1 returns base64 data instead of URL
            // Convert base64 to a data URL for consistent handling
            imageUrl = `data:image/png;base64,${base64Data}`;
            console.log('Received base64 image data, converted to data URL');
          }
          
          if (!imageUrl) {
            console.error('No image URL or base64 data in response. Full response data:', response.data);
            throw new Error('No image data returned from OpenAI');
          }

          // Store generated image with userId (it starts as 'generating' and we update to 'completed')
          const job = await storage.getGenerationJobById(jobId);
          const createdImage = await storage.createGeneratedImage({
            jobId: jobId,
            userId: job?.userId || null, // Use the job's userId for ownership
            visualConcept: concept,
            imageUrl: imageUrl,
            prompt: fullPrompt
          });
          
          // Update the image status to completed
          await storage.updateGeneratedImage(createdImage.id, { status: 'completed' });

          completedImages++;

          // Update job progress
          await storage.updateGenerationJob(jobId, {
            progress: Math.round((completedImages / totalImages) * 100),
            status: completedImages + failedImages >= totalImages ? 'completed' : 'running'
          });

          console.log(`Generated image ${completedImages}/${totalImages} successfully`);

          // Add small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Failed to generate image for concept "${concept}", variation ${variation}:`, error);
          failedImages++;

          // Update job with failure
          await storage.updateGenerationJob(jobId, {
            progress: Math.round(((completedImages + failedImages) / totalImages) * 100),
            status: completedImages + failedImages >= totalImages ? 'completed' : 'running'
          });
        }
      }
    }

    console.log(`Job ${jobId} completed: ${completedImages} successful, ${failedImages} failed`);

  } catch (error) {
    console.error(`Fatal error in job ${jobId}:`, error);
    
    // Mark job as failed
    await storage.updateGenerationJob(jobId, {
      status: 'failed'
    });
  }
}

// Async function to regenerate images with modifications using OpenAI's image edit API
async function generateRegeneratedImagesAsync(
  jobId: string,
  style: any,
  sourceImage: any,
  instruction: string,
  settings: any
) {
  let tempImagePath: string | null = null;
  let convertedImagePath: string | null = null;
  
  try {
    const totalImages = settings.variations || 1;
    let completedImages = 0;
    let failedImages = 0;

    // Download the source image to a temporary file for OpenAI's edit API
    console.log(`Downloading source image from: ${sourceImage.imageUrl}`);
    const downloadResult = await downloadImageToTempFile(sourceImage.imageUrl);
    tempImagePath = downloadResult.path;
    console.log(`Image downloaded to: ${tempImagePath} with type: ${downloadResult.contentType}`);

    // Convert image to RGBA format once before processing all variations
    const parsed = path.parse(tempImagePath);
    convertedImagePath = path.join(parsed.dir, `${parsed.name}_rgba.png`);
    
    try {
      await sharp(tempImagePath)
        .ensureAlpha() // Add alpha channel if missing
        .png() // Convert to PNG format which supports RGBA
        .toFile(convertedImagePath);
      console.log(`Image converted to RGBA format: ${convertedImagePath}`);
    } catch (error) {
      console.error('Failed to convert image to RGBA format:', error);
      throw new Error('Image format conversion failed - regeneration requires RGBA format');
    }

    // Prepare image file for reuse across all variations
    const imageFile = await toFile(fs.createReadStream(convertedImagePath), path.basename(convertedImagePath), {
      type: 'image/png'
    });

    for (let variation = 1; variation <= totalImages; variation++) {
      try {
        // Handle instruction for regeneration
        let editPrompt: string;
        let enhancedPrompt: string;
        
        if (instruction && instruction.trim().length > 0) {
          // Has instruction - handle as modification
          const maxPromptLength = 1000;
          editPrompt = instruction;
          
          if (instruction.length > maxPromptLength) {
            editPrompt = instruction.substring(0, maxPromptLength - 3) + '...';
            console.log(`Regeneration instruction truncated from ${instruction.length} to ${editPrompt.length} characters`);
          }
          
          console.log(`Regenerating image ${completedImages + 1}/${totalImages} with instruction: "${editPrompt}" (${editPrompt.length} chars)`);
          enhancedPrompt = `${editPrompt}. Keep all other details, composition, and style exactly the same. Only modify what is specifically requested.`;
        } else {
          // No instruction - enhancement only (settings change)
          editPrompt = 'enhance image quality and clarity';
          console.log(`Enhancing image ${completedImages + 1}/${totalImages} with improved settings (no instruction)`);
          enhancedPrompt = 'Enhance image quality and clarity while keeping all details, composition, and style exactly the same';
        }
        
        // Add transparent background instruction when transparency is enabled
        if (settings.transparency && settings.model === 'gpt-image-1') {
          enhancedPrompt += `. Render only the image subject on a transparent background`;
        }

        // Validate model supports editing
        const capability = MODEL_CAPABILITIES[settings.model];
        if (!capability || !capability.supportsEditing) {
          throw new Error(`Model ${settings.model} does not support image editing. Use DALL-E 2 or GPT Image 1 for regeneration.`);
        }
        console.log(`Enhanced prompt sent to OpenAI: "${enhancedPrompt}" (${enhancedPrompt.length} chars)`);
        
        // Build request params with model-specific validation (for edit API, we use image param instead of building through helper)
        const requestParams: any = {
          model: settings.model,
          image: imageFile,
          prompt: enhancedPrompt,
          size: settings.size,
          n: 1 // Explicitly request 1 variation
        };
        
        // Add quality only if supported with correct mapping per model
        if (capability.supportsQuality) {
          if (settings.quality === 'hd') {
            if (settings.model === 'dall-e-3') {
              requestParams.quality = 'hd';
            } else if (settings.model === 'gpt-image-1') {
              requestParams.quality = 'high';
            }
          } else {
            // Standard quality mapping per model
            if (settings.model === 'dall-e-3') {
              requestParams.quality = 'standard';
            } else if (settings.model === 'gpt-image-1') {
              requestParams.quality = 'medium'; // GPT Image 1 uses 'medium' instead of 'standard'
            }
          }
        }
        
        // Add transparency support (only gpt-image-1 supports true transparency)
        if (settings.transparency && settings.model === 'gpt-image-1') {
          requestParams.background = 'transparent'; // Request transparent background
        }
        
        const response = await openai.images.edit(requestParams);

        // Handle both URL and base64 image formats (same as generation)
        let imageUrl = response.data?.[0]?.url;
        const base64Data = response.data?.[0]?.b64_json;
        
        if (!imageUrl && base64Data) {
          // GPT Image 1 returns base64 data instead of URL
          imageUrl = `data:image/png;base64,${base64Data}`;
          console.log('Received base64 regenerated image data, converted to data URL');
        }
        
        if (!imageUrl) {
          throw new Error('No image data returned from OpenAI edit API');
        }

        // Store regenerated image with source reference
        const job = await storage.getGenerationJobById(jobId);
        const createdImage = await storage.createGeneratedImage({
          jobId: jobId,
          userId: job?.userId || null,
          sourceImageId: sourceImage.id, // Link to source image
          visualConcept: sourceImage.visualConcept, // Keep original concept
          regenerationInstruction: instruction, // Store the modification instruction
          imageUrl: imageUrl,
          prompt: `Image edit: ${editPrompt} (applied to original image)`
        });
        
        // Update the image status to completed
        await storage.updateGeneratedImage(createdImage.id, { status: 'completed' });

        completedImages++;

        // Update job progress
        await storage.updateGenerationJob(jobId, {
          progress: Math.round((completedImages / totalImages) * 100),
          status: completedImages + failedImages >= totalImages ? 'completed' : 'running'
        });

        console.log(`Regenerated image ${completedImages}/${totalImages} successfully using image edit API`);

        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to regenerate image with instruction "${instruction}", variation ${variation}:`, error);
        failedImages++;

        // Update job with failure
        await storage.updateGenerationJob(jobId, {
          progress: Math.round(((completedImages + failedImages) / totalImages) * 100),
          status: completedImages + failedImages >= totalImages ? 'completed' : 'running'
        });
      }
    }

    console.log(`Regeneration job ${jobId} completed: ${completedImages} successful, ${failedImages} failed`);

  } catch (error) {
    console.error(`Fatal error in regeneration job ${jobId}:`, error);
    
    // Mark job as failed
    await storage.updateGenerationJob(jobId, {
      status: 'failed'
    });
  } finally {
    // Clean up temporary image files
    if (tempImagePath) {
      cleanupTempFile(tempImagePath);
      console.log(`Cleaned up temporary image file: ${tempImagePath}`);
    }
    
    // Clean up converted RGBA image file
    if (convertedImagePath && fs.existsSync(convertedImagePath)) {
      cleanupTempFile(convertedImagePath);
      console.log(`Cleaned up converted RGBA image file: ${convertedImagePath}`);
    }
  }
}

// PROJECT SESSION ROUTES

// GET /api/sessions - Get all project sessions for authenticated user (Protected)
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await storage.getAllProjectSessions();
    // Filter sessions to only include user's own sessions (or all if admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    const filteredSessions = sessions.filter(session => 
      isAdmin || session.userId === userId
    );
    res.json(filteredSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/working - Always create a fresh working session for authenticated user (Protected)
router.get('/sessions/working', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Always create a fresh working session for new generations
    const workingSession = await storage.createProjectSession({
      userId,
      name: null,
      displayName: 'Working Session',
      visualConcepts: [],
      settings: {
        model: 'gpt-image-1',
        quality: 'standard',
        size: '1024x1024',
        transparency: false,
        variations: 1,
      },
      isTemporary: false,
      hasUnsavedChanges: false
    });
    
    res.json(workingSession);
  } catch (error) {
    console.error('Error creating working session:', error);
    res.status(500).json({ error: 'Failed to create working session' });
  }
});

// GET /api/sessions/:id - Get specific project session for authenticated user (Protected)
router.get('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const session = await storage.getProjectSessionById(req.params.id);
    if (!session) {
      console.error(`Session not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Session not found', sessionId: req.params.id });
    }
    
    // Verify ownership (user owns session or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    
    // Log detailed ownership information for debugging
    console.log(`Session access check: sessionId=${req.params.id}, sessionUserId=${session.userId}, requestUserId=${userId}, isAdmin=${isAdmin}`);
    
    if (!isAdmin && session.userId !== userId) {
      console.error(`Access denied: User ${userId} attempted to access session ${req.params.id} owned by ${session.userId}`);
      return res.status(403).json({ 
        error: 'Access denied: not your session',
        details: session.userId === null ? 'This session has no owner assigned' : 'Session belongs to another user'
      });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session', details: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/sessions/:id/images - Get all images for a project session (Protected)
router.get('/sessions/:id/images', requireAuth, async (req, res) => {
  try {
    console.log(`Fetching images for session: ${req.params.id}`);
    
    const session = await storage.getProjectSessionById(req.params.id);
    if (!session) {
      console.error(`Session not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify ownership (user owns session or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    console.log(`Access check for session ${req.params.id}: userId=${userId}, sessionUserId=${session.userId}, isAdmin=${isAdmin}`);
    
    if (!isAdmin && session.userId !== userId) {
      console.error(`Access denied for session ${req.params.id}: user ${userId} does not own session`);
      return res.status(403).json({ error: 'Access denied: not your session' });
    }
    
    // Get all images for this session
    console.log(`Calling storage.getGeneratedImagesBySessionId for session: ${req.params.id}`);
    const images = await storage.getGeneratedImagesBySessionId(req.params.id);
    console.log(`Successfully fetched ${images.length} images for session ${req.params.id}`);
    
    res.json(images);
  } catch (error) {
    console.error(`Error fetching session images for ${req.params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to fetch session images',
      details: errorMessage,
      sessionId: req.params.id
    });
  }
});

// POST /api/sessions/:id/migrate-jobs - Migrate generation jobs from another session (Protected)
router.post('/sessions/:id/migrate-jobs', requireAuth, async (req, res) => {
  try {
    const targetSessionId = req.params.id;
    const { sourceSessionId } = req.body;
    
    if (!sourceSessionId) {
      return res.status(400).json({ error: 'sourceSessionId is required' });
    }
    
    // Verify both sessions exist and belong to the user
    const targetSession = await storage.getProjectSessionById(targetSessionId);
    const sourceSession = await storage.getProjectSessionById(sourceSessionId);
    
    if (!targetSession || !sourceSession) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    
    if (!isAdmin && (targetSession.userId !== userId || sourceSession.userId !== userId)) {
      return res.status(403).json({ error: 'Access denied: not your session' });
    }
    
    // Migrate all generation jobs from source to target session
    const migratedCount = await storage.migrateGenerationJobsToSession(sourceSessionId, targetSessionId);
    
    res.json({ 
      message: 'Generation jobs migrated successfully',
      migratedCount 
    });
  } catch (error) {
    console.error('Error migrating generation jobs:', error);
    res.status(500).json({ error: 'Failed to migrate generation jobs' });
  }
});

// POST /api/sessions - Create new project session (Protected)
router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      displayName: z.string().min(1),
      styleId: z.string().optional(),
      visualConcepts: z.array(z.string()),
      settings: z.object({
        model: z.enum(['dall-e-2', 'dall-e-3', 'gpt-image-1']),
        quality: z.enum(['standard', 'hd']),
        size: z.enum(['1024x1024', '1536x1024', '1024x1536']),
        transparency: z.boolean(),
        variations: z.number().min(1).max(4)
      }),
      isTemporary: z.boolean().optional(),
      hasUnsavedChanges: z.boolean().optional()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const session = await storage.createProjectSession({
      ...validation.data,
      userId: (req as any).user.id // Scope to authenticated user
    });
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// PUT /api/sessions/:id - Update project session (Protected)
router.put('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      displayName: z.string().optional(),
      styleId: z.string().optional(),
      visualConcepts: z.array(z.string()).optional(),
      settings: z.object({
        model: z.enum(['dall-e-2', 'dall-e-3', 'gpt-image-1']),
        quality: z.enum(['standard', 'hd']),
        size: z.enum(['1024x1024', '1536x1024', '1024x1536']),
        transparency: z.boolean(),
        variations: z.number().min(1).max(4)
      }).optional(),
      isTemporary: z.boolean().optional(),
      hasUnsavedChanges: z.boolean().optional()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const session = await storage.updateProjectSession(req.params.id, validation.data);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// DELETE /api/sessions/:id - Delete project session (Protected)
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await storage.deleteProjectSession(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// GET /api/sessions/temporary - Get temporary sessions for authenticated user (Protected)
router.get('/sessions/temporary', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const sessions = await storage.getTemporarySessionsForUser(userId);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching temporary sessions:', error);
    res.status(500).json({ error: 'Failed to fetch temporary sessions' });
  }
});

// DELETE /api/sessions/temporary - Clear temporary sessions for authenticated user (Protected)
router.delete('/sessions/temporary', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const deletedCount = await storage.clearTemporarySessionsForUser(userId);
    res.json({ message: 'Temporary sessions cleared', deletedCount });
  } catch (error) {
    console.error('Error clearing temporary sessions:', error);
    res.status(500).json({ error: 'Failed to clear temporary sessions' });
  }
});

// AI STYLE EXTRACTION ROUTES

// POST /api/upload-reference-image - Upload reference image to object storage (Protected)
router.post('/upload-reference-image', requireAuth, upload.single('image'), async (req: Request & { file?: Express.Multer.File }, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const tempFilePath = req.file.path;
    const originalMimeType = req.file.mimetype;
    
    try {
      // OpenAI only supports: png, jpeg, gif, webp
      const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      const isSupported = supportedMimeTypes.includes(originalMimeType.toLowerCase());
      
      let finalBuffer: Buffer;
      let finalMimeType: string;
      let fileExtension: string;
      
      if (!isSupported) {
        // Convert unsupported formats (AVIF, HEIC, BMP, TIFF, etc.) to PNG
        console.log(`Converting unsupported image format ${originalMimeType} to PNG`);
        finalBuffer = await sharp(tempFilePath)
          .png()
          .toBuffer();
        finalMimeType = 'image/png';
        fileExtension = '.png';
      } else {
        // Keep original format if supported
        finalBuffer = await fs.promises.readFile(tempFilePath);
        finalMimeType = originalMimeType;
        fileExtension = path.extname(req.file.originalname) || '.png';
      }
      
      const fileName = `reference-${randomUUID()}${fileExtension}`;
      const base64Data = finalBuffer.toString('base64');
      const dataUrl = `data:${finalMimeType};base64,${base64Data}`;

      // Clean up temp file
      await fs.promises.unlink(tempFilePath);

      res.json({
        url: dataUrl,
        fileName: fileName,
        size: finalBuffer.length,
        mimetype: finalMimeType,
        converted: !isSupported
      });
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error uploading reference image:', error);
    res.status(500).json({ error: 'Failed to upload reference image' });
  }
});

// POST /api/extract-style - Extract style from reference image using GPT-5 vision (Protected)
router.post('/extract-style', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      imageUrl: z.string().min(1),
      extractionPrompt: z.string().min(1),
      conceptPrompt: z.string().min(1),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { imageUrl, extractionPrompt, conceptPrompt } = validation.data;

    // Hardcoded system message for reliable JSON structure
    const systemMessage = `You are a professional visual style analyst. You MUST respond with ONLY valid JSON that matches this exact structure:

{
  "style_name": "string - short descriptive name",
  "description": "string - detailed style analysis",
  "color_palette": ["#RRGGBB", "#RRGGBB", ...],
  "color_usage": "string - how colors are used",
  "lighting": "string - lighting characteristics", 
  "shadow_style": "string - shadow treatment",
  "shapes": "string - shape characteristics",
  "shape_edges": "string - edge treatment",
  "symmetry_balance": "string - balance and symmetry",
  "line_quality": "string - line characteristics",
  "line_color_treatment": "string - line color approach",
  "texture": "string - texture details",
  "material_suggestion": "string - material qualities",
  "rendering_style": "string - rendering approach",
  "detail_level": "string - level of detail",
  "perspective": "string - perspective characteristics",
  "scale_relationships": "string - scale and proportions",
  "composition": "string - compositional elements",
  "visual_hierarchy": "string - hierarchy approach",
  "typography": {
    "font_styles": "string - font characteristics",
    "font_weights": "string - weight usage",
    "case_usage": "string - case treatment",
    "alignment": "string - text alignment",
    "letter_spacing": "string - spacing approach",
    "text_treatment": "string - text effects"
  },
  "ui_elements": {
    "corner_radius": "string - corner treatment",
    "icon_style": "string - icon characteristics", 
    "button_style": "string - button treatment",
    "spacing_rhythm": "string - spacing patterns"
  },
  "motion_or_interaction": "string - motion qualities",
  "notable_visual_effects": "string - special effects"
}

Respond ONLY with valid JSON. No markdown, no explanations, no code blocks.`;

    // Extract style using GPT-4 Vision with system message + user prompt
    const styleResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: extractionPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 2000, // Increased for detailed JSON response
    });

    const styleAnalysis = styleResponse.choices[0]?.message?.content;
    if (!styleAnalysis) {
      throw new Error('No style analysis returned from OpenAI');
    }

    console.log('=== STYLE EXTRACTION DEBUG ===');
    console.log('Raw OpenAI Response Length:', styleAnalysis.length);
    console.log('Raw OpenAI Response (first 200 chars):', styleAnalysis.substring(0, 200));
    console.log('Raw OpenAI Response (last 200 chars):', styleAnalysis.substring(Math.max(0, styleAnalysis.length - 200)));

    // Try to parse as JSON, handling markdown code blocks, fallback to structured data
    let styleData;
    let jsonText = styleAnalysis.trim(); // Declare outside try block for proper scope
    try {
      // Remove markdown code block wrapper if present
      
      // Handle various markdown wrapper formats
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/m, '').replace(/\s*```$/m, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/m, '').replace(/\s*```$/m, '');
      }
      
      console.log('Cleaned JSON Text (first 200 chars):', jsonText.substring(0, 200));
      
      styleData = JSON.parse(jsonText);
      console.log('Successfully parsed JSON with keys:', Object.keys(styleData));
      
    } catch (parseError) {
      console.error('Failed to parse style analysis JSON:', parseError);
      console.error('Attempted to parse:', jsonText?.substring(0, 500));
      
      // Create a structured response from the raw text
      styleData = {
        style_name: "AI Extracted Style", 
        description: `Style analysis: ${styleAnalysis.substring(0, 500)}`,
        color_palette: ["#000000", "#FFFFFF"],
        color_usage: "Unable to parse color information",
        lighting: "Unable to parse lighting information", 
        shadow_style: "Unable to parse shadow information",
        shapes: "Unable to parse shape information",
        shape_edges: "Unable to parse edge information",
        symmetry_balance: "Unable to parse balance information",
        line_quality: "Unable to parse line information",
        line_color_treatment: "Unable to parse line color information",
        texture: "Unable to parse texture information",
        material_suggestion: "Unable to parse material information", 
        rendering_style: "Unable to parse rendering information",
        detail_level: "Unable to parse detail information",
        perspective: "Unable to parse perspective information",
        scale_relationships: "Unable to parse scale information",
        composition: "Unable to parse composition information",
        visual_hierarchy: "Unable to parse hierarchy information",
        typography: {
          font_styles: "Unable to parse typography",
          font_weights: "Unable to parse weights", 
          case_usage: "Unable to parse case usage",
          alignment: "Unable to parse alignment",
          letter_spacing: "Unable to parse spacing",
          text_treatment: "Unable to parse text treatment"
        },
        ui_elements: {
          corner_radius: "Unable to parse corner radius",
          icon_style: "Unable to parse icon style",
          button_style: "Unable to parse button style", 
          spacing_rhythm: "Unable to parse spacing rhythm"
        },
        motion_or_interaction: "Unable to parse motion information",
        notable_visual_effects: "Unable to parse effects information"
      };
    }
    
    console.log('Final styleData structure:', JSON.stringify(styleData, null, 2));

    // Generate concept using the same model
    const conceptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: conceptPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 800, // Increased to allow multiple detailed concepts in JSON array
    });

    let concept = conceptResponse.choices[0]?.message?.content?.trim();
    if (!concept) {
      throw new Error('No concept generated from OpenAI');
    }

    console.log('Raw concept response:', concept);

    // Parse JSON response to validate and clean, but keep the full structure
    try {
      // Remove markdown code blocks if present
      let cleanedConcept = concept;
      if (cleanedConcept.includes('```json')) {
        cleanedConcept = cleanedConcept.replace(/```json\s*/g, '').replace(/```/g, '');
      } else if (cleanedConcept.includes('```')) {
        cleanedConcept = cleanedConcept.replace(/```\s*/g, '').replace(/```/g, '');
      }
      
      cleanedConcept = cleanedConcept.trim();
      
      // Try to parse as JSON - if successful, use the cleaned JSON string
      JSON.parse(cleanedConcept); // Just validate it's valid JSON
      concept = cleanedConcept; // Use the full cleaned JSON string
      console.log('✓ Using full concept JSON (parsed and validated)');
    } catch (parseError) {
      // If not JSON, use the concept as-is
      console.log('Concept not in JSON format, using raw text. Parse error:', parseError instanceof Error ? parseError.message : 'Unknown error');
    }

    // Convert concept to human-readable text for display and image generation
    const conceptText = convertConceptJsonToText(concept);
    
    res.json({
      styleData,
      concept: conceptText,        // Human-readable text for display and image generation
      conceptJson: concept          // Original JSON for storage and future use
    });
  } catch (error) {
    console.error('Error extracting style:', error);
    res.status(500).json({ error: 'Failed to extract style from image' });
  }
});

// POST /api/generate-new-concept - Generate a new random concept for an existing style (Protected)
router.post('/generate-new-concept', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      styleId: z.string().min(1),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { styleId } = validation.data;

    // Fetch the style to get conceptPrompt and referenceImageUrl
    const style = await storage.getImageStyleById(styleId);
    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }

    if (!style.conceptPrompt) {
      return res.status(400).json({ error: 'Style does not have a concept prompt' });
    }

    if (!style.referenceImageUrl) {
      return res.status(400).json({ error: 'Style does not have a reference image' });
    }

    // Generate new concept using the same model and prompt
    const conceptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: style.conceptPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: style.referenceImageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 800, // Increased to allow multiple detailed concepts in JSON array
    });

    let concept = conceptResponse.choices[0]?.message?.content?.trim();
    if (!concept) {
      throw new Error('No concept generated from OpenAI');
    }

    console.log('Raw new concept response:', concept);

    // Parse JSON response to validate and clean
    try {
      // Remove markdown code blocks if present
      let cleanedConcept = concept;
      if (cleanedConcept.includes('```json')) {
        cleanedConcept = cleanedConcept.replace(/```json\s*/g, '').replace(/```/g, '');
      } else if (cleanedConcept.includes('```')) {
        cleanedConcept = cleanedConcept.replace(/```\s*/g, '').replace(/```/g, '');
      }
      
      cleanedConcept = cleanedConcept.trim();
      
      // Try to parse as JSON - if successful, use the cleaned JSON string
      JSON.parse(cleanedConcept); // Just validate it's valid JSON
      concept = cleanedConcept; // Use the full cleaned JSON string
      console.log('✓ Using full concept JSON (parsed and validated)');
    } catch (parseError) {
      // If not JSON, use the concept as-is
      console.log('Concept not in JSON format, using raw text');
    }

    // Convert concept to human-readable text for display
    const conceptText = convertConceptJsonToText(concept);
    
    res.json({
      concept: conceptText,
      conceptJson: concept
    });
  } catch (error) {
    console.error('Error generating new concept:', error);
    res.status(500).json({ error: 'Failed to generate new concept' });
  }
});

// POST /api/generate-style-preview - Generate preview image using extracted style (Protected)
router.post('/generate-style-preview', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      styleData: z.record(z.any()), // Accept the full extracted style data object
      concept: z.string().min(1),
      model: z.string().optional().default('gpt-image-1'),
      size: z.string().optional().default('1024x1024'),
      quality: z.string().optional().default('standard'),
      transparency: z.boolean().optional().default(false),
      renderText: z.boolean().optional().default(true),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { styleData, concept, model, size, quality, transparency, renderText } = validation.data;
    
    // Build a comprehensive style description from the extracted style data
    const styleDescription = buildStyleDescription(styleData);
    
    // Build prompt combining concept and full style description
    let fullPrompt = `${concept}. Style: ${styleDescription}`;
    
    // Add transparent background instruction when transparency is enabled
    if (transparency && model === 'gpt-image-1') {
      fullPrompt += `. Render only the image subject on a transparent background`;
    }
    
    // Add "NO TEXT" instruction when renderText is disabled
    if (!renderText) {
      fullPrompt += `. NO TEXT`;
    }
    
    // Use configurable settings for preview generation
    const requestParams = buildImageParams(model, size, quality, fullPrompt, transparency);
    
    console.log('Generating style preview with prompt:', fullPrompt);
    
    const response = await openai.images.generate(requestParams);
    
    let imageUrl: string;
    
    // Handle both URL and base64 JSON responses (model-agnostic)
    const responseData = response.data?.[0];
    if (responseData?.b64_json) {
      // Convert base64 to data URL for frontend use (preferred when available)
      imageUrl = `data:image/png;base64,${responseData.b64_json}`;
    } else if (responseData?.url) {
      // Use URL when base64 is not available
      imageUrl = responseData.url;
    } else {
      throw new Error('No image data returned from OpenAI');
    }

    res.json({
      imageUrl,
      prompt: fullPrompt
    });
  } catch (error) {
    console.error('Error generating style preview:', error);
    res.status(500).json({ error: 'Failed to generate style preview' });
  }
});

// POST /api/refine-style - Refine style definition using GPT-5 based on user feedback (Protected)
router.post('/refine-style', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      styleData: z.any(), // Accept any dynamic style structure including nested objects
      feedback: z.string().min(1),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { styleData, feedback } = validation.data;

    // System message for style refinement
    const systemMessage = `You are a professional visual style analyst. The user will provide you with a current style definition (in JSON format) and feedback for improvement. 

Your task is to:
1. Carefully read the current style definition structure and user feedback
2. Make changes PROPORTIONAL to the instruction - subtle feedback gets subtle changes, dramatic feedback gets dramatic changes
3. Update ALL relevant fields that relate to the feedback (not just one field)
4. Maintain the EXACT SAME JSON structure and field names as the input
5. Only modify field VALUES - do not add or remove fields or change the structure

CRITICAL - Description Field Requirements:
- The "description" field is THE MOST IMPORTANT field and MUST ALWAYS be significantly updated
- ALWAYS expand/rewrite the description to be 2-3 detailed sentences (not just 1 short sentence)
- The description should incorporate the feedback and paint a comprehensive picture of the visual style
- Include sensory details, technical aspects, and the overall aesthetic impression
- Example good description: "A bold urban photography style characterized by direct frontal flash lighting that creates stark, dramatic contrasts. The aesthetic combines vintage film grain with contemporary street photography sensibilities, featuring cool color temperatures that offset warm accent tones. This approach emphasizes raw, authentic moments with high-impact lighting that flattens depth and creates an intimate, documentary-style feel."

For other fields:
- Make changes appropriate to the feedback intensity
- Update all related fields consistently (e.g., if changing lighting, also update shadows, contrast, mood, etc.)
- Use precise, descriptive language

Rules:
- Respond with ONLY valid JSON (no markdown, no code blocks, no explanations)
- Match the exact structure of the input styleData
- ALWAYS expand the description field to 2-3 detailed sentences
- Update all relevant fields proportionally
- Keep nested objects and arrays intact`;

    const userMessage = `Current style definition:
${JSON.stringify(styleData, null, 2)}

User feedback for refinement:
${feedback}

Please provide the refined style definition in the same JSON format.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user", 
          content: userMessage
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    let jsonText = completion.choices[0]?.message?.content?.trim();
    if (!jsonText) {
      throw new Error('No response from OpenAI');
    }

    // Clean up the response - remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let refinedStyleData;
    try {
      refinedStyleData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse refined style JSON:', jsonText);
      throw new Error('Invalid JSON response from style refinement');
    }

    console.log('=== STYLE REFINEMENT RESULTS ===');
    console.log('Feedback:', feedback);
    console.log('Original style data:', JSON.stringify(styleData, null, 2));
    console.log('Refined style data:', JSON.stringify(refinedStyleData, null, 2));
    console.log('================================');

    res.json({
      refinedStyleData,
      originalFeedback: feedback
    });
  } catch (error) {
    console.error('Error refining style:', error);
    res.status(500).json({ error: 'Failed to refine style definition' });
  }
});

// User Preferences API endpoints
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const preferences = await storage.getUserPreferences(userId);
    
    if (!preferences) {
      return res.status(404).json({ error: 'User preferences not found' });
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to fetch user preferences' });
  }
});

router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { defaultExtractionPrompt, defaultConceptPrompt } = req.body;
    
    // Validate input
    if (!defaultExtractionPrompt || !defaultConceptPrompt) {
      return res.status(400).json({ error: 'Both extraction and concept prompts are required' });
    }
    
    if (typeof defaultExtractionPrompt !== 'string' || typeof defaultConceptPrompt !== 'string') {
      return res.status(400).json({ error: 'Prompts must be strings' });
    }
    
    const preferences = await storage.updateUserPreferences(userId, {
      defaultExtractionPrompt,
      defaultConceptPrompt
    });
    
    res.json(preferences);
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to update user preferences' });
  }
});

// System Prompts Routes

// GET /api/prompts - Get all system prompts (Protected)
router.get('/prompts', requireAuth, async (req, res) => {
  try {
    const { category } = req.query;
    
    let prompts;
    if (category && (category === 'style_extraction' || category === 'concept_generation')) {
      prompts = await storage.getSystemPromptsByCategory(category);
    } else {
      prompts = await storage.getAllSystemPrompts();
    }
    
    res.json(prompts);
  } catch (error) {
    console.error('Error fetching system prompts:', error);
    res.status(500).json({ error: 'Failed to fetch system prompts' });
  }
});

// GET /api/prompts/default/:category - Get default prompt for a category (Protected)
router.get('/prompts/default/:category', requireAuth, async (req, res) => {
  try {
    const { category } = req.params;
    
    if (category !== 'style_extraction' && category !== 'concept_generation') {
      return res.status(400).json({ error: 'Invalid category. Must be style_extraction or concept_generation' });
    }
    
    const prompt = await storage.getDefaultSystemPromptByCategory(category as 'style_extraction' | 'concept_generation');
    
    if (!prompt) {
      return res.status(404).json({ error: 'No default prompt found for this category' });
    }
    
    res.json(prompt);
  } catch (error) {
    console.error('Error fetching default system prompt:', error);
    res.status(500).json({ error: 'Failed to fetch default system prompt' });
  }
});

// GET /api/prompts/:id - Get a specific system prompt by ID (Protected)
router.get('/prompts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const prompt = await storage.getSystemPromptById(id);
    
    if (!prompt) {
      return res.status(404).json({ error: 'System prompt not found' });
    }
    
    res.json(prompt);
  } catch (error) {
    console.error('Error fetching system prompt:', error);
    res.status(500).json({ error: 'Failed to fetch system prompt' });
  }
});

// POST /api/prompts - Create a new system prompt (Protected)
router.post('/prompts', requireAuth, async (req, res) => {
  try {
    const validation = insertSystemPromptSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const prompt = await storage.createSystemPrompt({
      ...validation.data,
      createdBy: (req as any).user.id
    });
    res.status(201).json(prompt);
  } catch (error) {
    console.error('Error creating system prompt:', error);
    res.status(500).json({ error: 'Failed to create system prompt' });
  }
});

// PUT /api/prompts/:id - Update an existing system prompt (Protected)
router.put('/prompts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const validation = insertSystemPromptSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const prompt = await storage.updateSystemPrompt(id, validation.data);
    if (!prompt) {
      return res.status(404).json({ error: 'System prompt not found' });
    }
    
    res.json(prompt);
  } catch (error) {
    console.error('Error updating system prompt:', error);
    res.status(500).json({ error: 'Failed to update system prompt' });
  }
});

// DELETE /api/prompts/:id - Delete a system prompt (Protected)
router.delete('/prompts/:id', requireAuth, async (req, res) => {
  try {
    const { id} = req.params;
    const deleted = await storage.deleteSystemPrompt(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'System prompt not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting system prompt:', error);
    res.status(500).json({ error: 'Failed to delete system prompt' });
  }
});

// Concept List Routes

// GET /api/concept-lists - Get all concept lists (Protected)
router.get('/concept-lists', requireAuth, async (req, res) => {
  try {
    const conceptLists = await storage.getAllConceptLists();
    res.json(conceptLists);
  } catch (error) {
    console.error('Error fetching concept lists:', error);
    res.status(500).json({ error: 'Failed to fetch concept lists' });
  }
});

// GET /api/concept-lists/:id - Get a specific concept list (Protected)
router.get('/concept-lists/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const conceptList = await storage.getConceptListById(id);
    
    if (!conceptList) {
      return res.status(404).json({ error: 'Concept list not found' });
    }
    
    res.json(conceptList);
  } catch (error) {
    console.error('Error fetching concept list:', error);
    res.status(500).json({ error: 'Failed to fetch concept list' });
  }
});

// POST /api/generate-concept-list - Generate a new concept list with AI (Protected)
router.post('/generate-concept-list', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { 
      name, 
      companyName, 
      referenceImageUrl, 
      marketingContent, 
      promptId,
      promptText,
      quantity = 5,
      temperature = 0.7,
      literalMetaphorical = 0,
      simpleComplex = 0
    } = req.body;

    if (!companyName || !marketingContent) {
      return res.status(400).json({ error: 'Company name and marketing content are required' });
    }

    // Validate parameter ranges
    if (temperature < 0 || temperature > 1) {
      return res.status(400).json({ error: 'Temperature must be between 0 and 1' });
    }
    if (literalMetaphorical < -1 || literalMetaphorical > 1) {
      return res.status(400).json({ error: 'Literal/Metaphorical value must be between -1 and 1' });
    }
    if (simpleComplex < -1 || simpleComplex > 1) {
      return res.status(400).json({ error: 'Simple/Complex value must be between -1 and 1' });
    }

    // Call OpenAI API to generate concepts
    
    // Build the system prompt with hard-coded output instructions for reliability
    const baseSystemPrompt = promptText || `You are a creative marketing concept generator. Generate visual concepts based on the company context and marketing content provided.`;
    
    // Generate style guidance based on slider values
    let styleGuidance = '';
    
    // Literal <-> Metaphorical guidance
    if (literalMetaphorical < -0.3) {
      styleGuidance += '\n\nSTYLE: Use concrete, specific, literal descriptions. Focus on tangible visual elements and clear subjects. Avoid metaphors and abstract imagery.';
    } else if (literalMetaphorical > 0.3) {
      styleGuidance += '\n\nSTYLE: Use creative metaphors, symbolic imagery, and abstract representations. Embrace poetic and conceptual language.';
    }
    
    // Simple <-> Complex guidance
    if (simpleComplex < -0.3) {
      styleGuidance += '\n\nCOMPOSITION: Keep subjects simple and focused. Use single, clear focal points. Minimize elements and maintain visual clarity.';
    } else if (simpleComplex > 0.3) {
      styleGuidance += '\n\nCOMPOSITION: Create multi-layered compositions with multiple elements. Combine various visual components to create rich, detailed scenes.';
    }
    
    const systemPrompt = `${baseSystemPrompt}${styleGuidance}

IMPORTANT OUTPUT FORMAT:
Return ONLY a JSON array of strings. Each string should be a complete concept description.
Example format: ["Concept 1 description...", "Concept 2 description...", "Concept 3 description..."]
Do NOT wrap in an object with "concepts" key. Do NOT use markdown code blocks.`;
    
    // Build the user message
    let userMessage = `Company: ${companyName}\n\nMarketing Content:\n${marketingContent}\n\nGenerate ${quantity} distinct visual marketing concepts that would effectively communicate this message.`;
    
    if (referenceImageUrl) {
      userMessage += `\n\nConsider the visual style and elements from the provided reference image.`;
    }

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // If there's a reference image, add it to the message
    if (referenceImageUrl) {
      messages[1] = {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: referenceImageUrl } }
        ]
      };
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: temperature,
    });

    let responseText = completion.choices[0]?.message?.content || '[]';
    
    // Strip markdown code blocks if present
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Parse and normalize concepts to simple, consistent format
    let concepts: Concept[];
    try {
      const parsed = JSON.parse(responseText);
      
      let rawConcepts: any[];
      
      // Handle two formats: direct array or object with "concepts" key
      if (Array.isArray(parsed)) {
        rawConcepts = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.concepts)) {
        rawConcepts = parsed.concepts;
      } else {
        throw new Error('Response must be an array or an object with a "concepts" array property');
      }
      
      // Normalize all concepts to simple objects with a "concept" field
      concepts = rawConcepts.map((concept, index) => {
        if (typeof concept === 'string') {
          // Wrap simple string in object for consistent storage
          return { concept: concept };
        } else if (typeof concept === 'object' && concept !== null) {
          // Keep object as-is (supports custom structures)
          return concept;
        } else {
          return { concept: `Concept ${index + 1}` };
        }
      });
      
      // Validate we have at least some concepts
      if (concepts.length === 0) {
        throw new Error('Concepts array is empty');
      }
    } catch (parseError) {
      console.error('Failed to parse concepts JSON:', parseError);
      console.error('Response text:', responseText);
      return res.status(500).json({ 
        error: 'Failed to parse AI response',
        details: 'The AI must return a JSON array of concept strings or objects.'
      });
    }

    // Create the concept list in storage
    const conceptList = await storage.createConceptList({
      name: name || `${companyName} - ${new Date().toLocaleDateString()}`,
      companyName,
      referenceImageUrl: referenceImageUrl || null,
      marketingContent,
      promptId: promptId || null,
      promptText: promptText || null,
      temperature,
      literalMetaphorical,
      simpleComplex,
      concepts,
      userId
    });

    res.json(conceptList);
  } catch (error) {
    console.error('Error generating concept list:', error);
    res.status(500).json({ error: 'Failed to generate concept list' });
  }
});

// PATCH /api/concept-lists/:id - Update a concept list (Protected)
router.patch('/concept-lists/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, concepts, marketingContent } = req.body;

    const updates: Partial<InsertConceptList> = {};
    if (name !== undefined) updates.name = name;
    if (concepts !== undefined) updates.concepts = concepts;
    if (marketingContent !== undefined) updates.marketingContent = marketingContent;

    const conceptList = await storage.updateConceptList(id, updates);
    
    if (!conceptList) {
      return res.status(404).json({ error: 'Concept list not found' });
    }
    
    res.json(conceptList);
  } catch (error) {
    console.error('Error updating concept list:', error);
    res.status(500).json({ error: 'Failed to update concept list' });
  }
});

// POST /api/concept-lists/:id/revise - Revise a concept list with feedback (Protected)
router.post('/concept-lists/:id/revise', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    const existingList = await storage.getConceptListById(id);
    if (!existingList) {
      return res.status(404).json({ error: 'Concept list not found' });
    }

    // Call OpenAI API to revise concepts
    const baseSystemPrompt = existingList.promptText || `You are a creative marketing concept generator. Revise visual concepts based on user feedback.`;
    
    const systemPrompt = `${baseSystemPrompt}

IMPORTANT OUTPUT FORMAT:
Return ONLY a JSON array of strings. Each string should be a complete concept description.
Example format: ["Concept 1 description...", "Concept 2 description...", "Concept 3 description..."]
Do NOT wrap in an object with "concepts" key. Do NOT use markdown code blocks.`;
    
    // Format current concepts as JSON for context
    const conceptsFormatted = JSON.stringify(existingList.concepts, null, 2);
    
    const userMessage = `Company: ${existingList.companyName}\n\nMarketing Content:\n${existingList.marketingContent}\n\nCurrent Concepts:\n${conceptsFormatted}\n\nUser Feedback:\n${feedback}\n\nRevise ALL ${existingList.concepts.length} concepts based on this feedback. Return only a valid JSON array of strings, no markdown.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // If there's a reference image, add it
    if (existingList.referenceImageUrl) {
      messages[1] = {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: existingList.referenceImageUrl } }
        ]
      };
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.8,
    });

    let responseText = completion.choices[0]?.message?.content || '[]';
    
    // Strip markdown code blocks if present
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Parse and normalize revised concepts
    let concepts: Concept[];
    try {
      const parsed = JSON.parse(responseText);
      
      let rawConcepts: any[];
      
      // Handle two formats: direct array or object with "concepts" key
      if (Array.isArray(parsed)) {
        rawConcepts = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.concepts)) {
        rawConcepts = parsed.concepts;
      } else {
        throw new Error('Response must be an array or an object with a "concepts" array property');
      }
      
      // Normalize all concepts to simple objects
      concepts = rawConcepts.map((concept, index) => {
        if (typeof concept === 'string') {
          return { concept: concept };
        } else if (typeof concept === 'object' && concept !== null) {
          return concept;
        } else {
          return { concept: `Concept ${index + 1}` };
        }
      });
      
      // Validate that we got concepts back
      if (concepts.length === 0) {
        console.error('OpenAI returned empty array. Response text:', responseText);
        throw new Error('Empty concepts array returned');
      }
      
      // Warn if count doesn't match but allow it (user might want fewer)
      if (concepts.length !== existingList.concepts.length) {
        console.warn(`Concept count changed from ${existingList.concepts.length} to ${concepts.length}`);
      }
    } catch (parseError) {
      console.error('Failed to parse revised concepts JSON:', parseError);
      console.error('Response text:', responseText);
      // Fallback: keep original concepts
      concepts = existingList.concepts;
      console.log('Using original concepts as fallback');
    }

    // Update the concept list with revised concepts
    const updatedList = await storage.updateConceptList(id, { concepts });
    
    res.json(updatedList);
  } catch (error) {
    console.error('Error revising concept list:', error);
    res.status(500).json({ error: 'Failed to revise concept list' });
  }
});

// DELETE /api/concept-lists/:id - Delete a concept list (Protected)
router.delete('/concept-lists/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteConceptList(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Concept list not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting concept list:', error);
    res.status(500).json({ error: 'Failed to delete concept list' });
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication system - From blueprint:javascript_auth_all_persistance
  setupAuth(app);
  
  // Register API routes
  app.use('/api', router);

  const httpServer = createServer(app);
  return httpServer;
}