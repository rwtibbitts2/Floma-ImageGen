// API helper functions for image generation
import { ImageStyle, GenerationJob, GeneratedImage, GenerationSettings } from '@shared/schema';

const API_BASE = '/api';

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
}

// Authentication API
export const login = async (credentials: LoginRequest): Promise<User> => {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
    credentials: 'include', // Include cookies for session
  });
  if (!response.ok) {
    throw new Error('Invalid email or password');
  }
  return response.json();
};

export const register = async (userData: RegisterRequest): Promise<User> => {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
    credentials: 'include', // Include cookies for session
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }
  return response.json();
};

export const logout = async (): Promise<void> => {
  const response = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Logout failed');
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await fetch(`${API_BASE}/user`, {
      credentials: 'include',
    });
    if (response.status === 401) {
      return null; // User not authenticated
    }
    if (!response.ok) {
      throw new Error('Failed to get user');
    }
    return response.json();
  } catch (error) {
    return null;
  }
};

export interface GenerationRequest {
  jobName: string;
  styleId: string;
  concepts: string[];
  settings: GenerationSettings;
  sessionId?: string; // Optional sessionId for image persistence
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

export const updateImageStyle = async (id: string, style: Partial<{ name: string; stylePrompt: string; description?: string }>): Promise<ImageStyle> => {
  const response = await fetch(`${API_BASE}/styles/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(style),
  });
  if (!response.ok) {
    throw new Error('Failed to update image style');
  }
  return response.json();
};

export const deleteImageStyle = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/styles/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete image style');
  }
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

// PROJECT SESSION API FUNCTIONS

export const getAllProjectSessions = async () => {
  const response = await fetch('/api/sessions');
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
};

export const getProjectSessionById = async (id: string) => {
  const response = await fetch(`/api/sessions/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch session');
  }
  return response.json();
};

export const createProjectSession = async (sessionData: {
  name?: string;
  displayName: string;
  styleId?: string;
  visualConcepts: string[];
  settings: any;
  isTemporary?: boolean;
  hasUnsavedChanges?: boolean;
}) => {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sessionData),
  });

  if (!response.ok) {
    throw new Error('Failed to create session');
  }

  return response.json();
};

export const updateProjectSession = async (id: string, updates: any) => {
  const response = await fetch(`/api/sessions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update session');
  }

  return response.json();
};

export const deleteProjectSession = async (id: string) => {
  const response = await fetch(`/api/sessions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete session');
  }
};

export const getTemporarySession = async () => {
  const response = await fetch('/api/sessions/temporary');
  if (!response.ok) {
    throw new Error('Failed to fetch temporary session');
  }
  return response.json();
};

export const clearTemporarySessions = async () => {
  const response = await fetch('/api/sessions/temporary', {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to clear temporary sessions');
  }
};