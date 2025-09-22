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
          // Combine style prompt with visual concept
          const fullPrompt = `${style.stylePrompt} ${concept}`;
          
          console.log(`Generating image ${completedImages + 1}/${totalImages}: "${fullPrompt}"`);

          // Generate image using OpenAI
          const response = await openai.images.generate({
            model: settings.model || "gpt-image-1",
            prompt: fullPrompt,
            n: 1,
            size: settings.size,
            quality: settings.quality,
            response_format: settings.transparency ? "url" : "url" // Note: DALL-E doesn't support transparency yet
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Register API routes
  app.use('/api', router);

  const httpServer = createServer(app);
  return httpServer;
}