// API helper functions for image generation
import { ImageStyle, GenerationJob, GeneratedImage, GenerationSettings } from '@shared/schema';

const API_BASE = '/api';

export interface GenerationRequest {
  jobName: string;
  styleId: string;
  concepts: string[];
  settings: GenerationSettings;
}

export interface GenerationResponse {
  jobId: string;
  message: string;
}

// Image Styles API
export const getImageStyles = async (): Promise<ImageStyle[]> => {
  const response = await fetch(`${API_BASE}/styles`);
  if (!response.ok) {
    throw new Error('Failed to fetch image styles');
  }
  return response.json();
};

export const createImageStyle = async (style: { name: string; stylePrompt: string; description?: string }): Promise<ImageStyle> => {
  const response = await fetch(`${API_BASE}/styles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(style),
  });
  if (!response.ok) {
    throw new Error('Failed to create image style');
  }
  return response.json();
};

// Generation Job API
export const startGeneration = async (request: GenerationRequest): Promise<GenerationResponse> => {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to start generation');
  }
  return response.json();
};

export const getGenerationJob = async (jobId: string): Promise<GenerationJob> => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch generation job');
  }
  return response.json();
};

export const getGeneratedImages = async (jobId: string): Promise<GeneratedImage[]> => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/images`);
  if (!response.ok) {
    throw new Error('Failed to fetch generated images');
  }
  return response.json();
};

// Progress polling helper
export const pollGenerationProgress = (
  jobId: string,
  onProgress: (job: GenerationJob, images: GeneratedImage[]) => void,
  onComplete: (job: GenerationJob, images: GeneratedImage[]) => void,
  onError: (error: Error) => void,
  interval: number = 2000
) => {
  const poll = async () => {
    try {
      const [job, images] = await Promise.all([
        getGenerationJob(jobId),
        getGeneratedImages(jobId)
      ]);

      onProgress(job, images);

      if (job.status === 'completed' || job.status === 'failed') {
        onComplete(job, images);
        return;
      }

      // Continue polling if still running
      if (job.status === 'running') {
        setTimeout(poll, interval);
      }
    } catch (error) {
      onError(error as Error);
    }
  };

  // Start polling immediately
  poll();
};