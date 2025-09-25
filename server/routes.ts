import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from 'express';
import { insertImageStyleSchema, insertGenerationJobSchema, insertGeneratedImageSchema, GenerationSettings } from '@shared/schema';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import OpenAI, { toFile } from 'openai';
import { nanoid } from 'nanoid';
import { setupAuth, requireAuth } from './auth'; // From blueprint:javascript_auth_all_persistance
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Utility function to download image from URL to temporary file
async function downloadImageToTempFile(imageUrl: string): Promise<{ path: string; contentType: string; }> {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
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

// POST /api/generate - Start image generation job (Protected)
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      jobName: z.string().min(1),
      styleId: z.string(),
      concepts: z.array(z.string()).min(1),
      settings: z.object({
        quality: z.enum(['standard', 'hd']),
        size: z.enum(['1024x1024', '1792x1024', '1024x1792']),
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
      instruction: z.string().min(1),
      sessionId: z.string().optional() // Optional sessionId for image persistence
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { sourceImageId, instruction, sessionId } = validation.data;

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

    // Create regeneration job with modified concept
    const modifiedConcept = `${sourceImage.visualConcept} (${instruction})`;
    const job = await storage.createGenerationJob({
      name: `Regeneration: ${modifiedConcept}`,
      userId: userId,
      sessionId: sessionId || sourceJob.sessionId, // Use provided sessionId or inherit from source
      styleId: sourceJob.styleId!,
      visualConcepts: [modifiedConcept],
      settings: sourceJob.settings // Inherit settings from source job
    });
    
    // Update job to running status
    await storage.updateGenerationJob(job.id, { status: 'running' });

    // Start regeneration process asynchronously, passing source image info
    generateRegeneratedImagesAsync(job.id, style, sourceImage, instruction, sourceJob.settings);

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
          // Construct professional structured prompt with clear labeling
          const fullPrompt = `Generate a clean, professional digital asset:
Style: ${style.stylePrompt}
Subject: ${concept}`;
          
          console.log(`Generating image ${completedImages + 1}/${totalImages}: "${fullPrompt}"`);

          // Map quality values to OpenAI-supported values
          const qualityMapping = {
            'standard': 'standard',
            'hd': 'high'
          } as const;
          
          // Generate image using OpenAI
          const response = await openai.images.generate({
            model: settings.model || "dall-e-3",
            prompt: fullPrompt,
            n: 1,
            size: settings.size,
            quality: qualityMapping[settings.quality as keyof typeof qualityMapping] || 'standard'
          });

          const imageUrl = response.data?.[0]?.url;
          if (!imageUrl) {
            throw new Error('No image URL returned from OpenAI');
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
  
  try {
    const totalImages = settings.variations || 1;
    let completedImages = 0;
    let failedImages = 0;

    // Download the source image to a temporary file for OpenAI's edit API
    console.log(`Downloading source image from: ${sourceImage.imageUrl}`);
    const downloadResult = await downloadImageToTempFile(sourceImage.imageUrl);
    tempImagePath = downloadResult.path;
    console.log(`Image downloaded to: ${tempImagePath} with type: ${downloadResult.contentType}`);

    for (let variation = 1; variation <= totalImages; variation++) {
      try {
        // Use a focused instruction prompt for better results
        const editPrompt = instruction;
        
        console.log(`Regenerating image ${completedImages + 1}/${totalImages} with instruction: "${editPrompt}"`);

        // Map quality values to OpenAI image edit API supported values
        const qualityMapping = {
          'standard': 'medium',
          'hd': 'high'
        } as const;
        
        // Use OpenAI's image edit API to modify the source image with explicit content type
        const imageFile = await toFile(fs.createReadStream(tempImagePath), path.basename(tempImagePath), {
          type: downloadResult.contentType
        });
        
        const response = await openai.images.edit({
          model: "gpt-image-1", // Use the latest image model
          image: imageFile,
          prompt: editPrompt,
          size: settings.size,
          quality: qualityMapping[settings.quality as keyof typeof qualityMapping] || 'medium'
        });

        const imageUrl = response.data?.[0]?.url;
        if (!imageUrl) {
          throw new Error('No image URL returned from OpenAI');
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
    // Clean up temporary image file
    if (tempImagePath) {
      cleanupTempFile(tempImagePath);
      console.log(`Cleaned up temporary image file: ${tempImagePath}`);
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
        model: 'dall-e-3',
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
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify ownership (user owns session or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: not your session' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// GET /api/sessions/:id/images - Get all images for a project session (Protected)
router.get('/sessions/:id/images', requireAuth, async (req, res) => {
  try {
    const session = await storage.getProjectSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify ownership (user owns session or is admin)
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'admin';
    if (!isAdmin && session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: not your session' });
    }
    
    // Get all images for this session
    const images = await storage.getGeneratedImagesBySessionId(req.params.id);
    res.json(images);
  } catch (error) {
    console.error('Error fetching session images:', error);
    res.status(500).json({ error: 'Failed to fetch session images' });
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
        size: z.enum(['1024x1024', '1792x1024', '1024x1792']),
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
        size: z.enum(['1024x1024', '1792x1024', '1024x1792']),
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication system - From blueprint:javascript_auth_all_persistance
  setupAuth(app);
  
  // Register API routes
  app.use('/api', router);

  const httpServer = createServer(app);
  return httpServer;
}