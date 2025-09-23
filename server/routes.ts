import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from 'express';
import { insertImageStyleSchema, insertGenerationJobSchema, insertGeneratedImageSchema, GenerationSettings } from '@shared/schema';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import OpenAI from 'openai';
import { nanoid } from 'nanoid';

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GET /api/styles - Get all image styles
router.get('/styles', async (req, res) => {
  try {
    const styles = await storage.getAllImageStyles();
    res.json(styles);
  } catch (error) {
    console.error('Error fetching styles:', error);
    res.status(500).json({ error: 'Failed to fetch styles' });
  }
});

// POST /api/styles - Create a new image style
router.post('/styles', async (req, res) => {
  try {
    const validation = insertImageStyleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const style = await storage.createImageStyle(validation.data);
    res.status(201).json(style);
  } catch (error) {
    console.error('Error creating style:', error);
    res.status(500).json({ error: 'Failed to create style' });
  }
});

// PUT /api/styles/:id - Update an existing image style
router.put('/styles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = insertImageStyleSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const updatedStyle = await storage.updateImageStyle(id, validation.data);
    if (!updatedStyle) {
      return res.status(404).json({ error: 'Style not found' });
    }

    res.json(updatedStyle);
  } catch (error) {
    console.error('Error updating style:', error);
    res.status(500).json({ error: 'Failed to update style' });
  }
});

// DELETE /api/styles/:id - Delete an image style
router.delete('/styles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteImageStyle(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Style not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting style:', error);
    res.status(500).json({ error: 'Failed to delete style' });
  }
});

// POST /api/generate - Start image generation job
router.post('/generate', async (req, res) => {
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
      })
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: fromZodError(validation.error).toString()
      });
    }

    const { jobName, styleId, concepts, settings } = validation.data;

    // Get the selected style
    const style = await storage.getImageStyleById(styleId);
    if (!style) {
      return res.status(404).json({ error: 'Style not found' });
    }

    // Create generation job
    const job = await storage.createGenerationJob({
      name: jobName,
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

// GET /api/jobs/:id - Get generation job status
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await storage.getGenerationJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// GET /api/jobs/:id/images - Get generated images for a job
router.get('/jobs/:id/images', async (req, res) => {
  try {
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

          // Store generated image (it starts as 'generating' and we update to 'completed')
          const createdImage = await storage.createGeneratedImage({
            jobId: jobId,
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

// PROJECT SESSION ROUTES

// GET /api/sessions - Get all project sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await storage.getAllProjectSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:id - Get specific project session
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await storage.getProjectSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /api/sessions - Create new project session
router.post('/sessions', async (req, res) => {
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

    const session = await storage.createProjectSession(validation.data);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// PUT /api/sessions/:id - Update project session
router.put('/sessions/:id', async (req, res) => {
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

// DELETE /api/sessions/:id - Delete project session
router.delete('/sessions/:id', async (req, res) => {
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

// GET /api/sessions/temporary - Get current temporary session
router.get('/sessions/temporary', async (req, res) => {
  try {
    const session = await storage.getTemporarySession();
    res.json(session || null);
  } catch (error) {
    console.error('Error fetching temporary session:', error);
    res.status(500).json({ error: 'Failed to fetch temporary session' });
  }
});

// DELETE /api/sessions/temporary - Clear all temporary sessions
router.delete('/sessions/temporary', async (req, res) => {
  try {
    await storage.clearTemporarySessions();
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing temporary sessions:', error);
    res.status(500).json({ error: 'Failed to clear temporary sessions' });
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Register API routes
  app.use('/api', router);

  const httpServer = createServer(app);
  return httpServer;
}