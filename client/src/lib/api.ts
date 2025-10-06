// API helper functions for image generation
import { ImageStyle, GenerationJob, GeneratedImage, GenerationSettings, ProjectSession, SystemPrompt, ConceptList, Concept } from '@shared/schema';

const API_BASE = '/api';

// Helper function to make authenticated fetch requests
async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

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
  token?: string; // JWT token returned on login
}

// Authentication API
export const login = async (credentials: LoginRequest): Promise<User> => {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    throw new Error('Invalid email or password');
  }
  const user = await response.json();
  
  // Store JWT token in localStorage
  if (user.token) {
    localStorage.setItem('authToken', user.token);
  }
  
  return user;
};

// Register function removed - now admin-only user creation

export const logout = async (): Promise<void> => {
  const token = localStorage.getItem('authToken');
  
  const response = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  
  // Remove JWT token from localStorage regardless of response
  localStorage.removeItem('authToken');
  
  if (!response.ok) {
    throw new Error('Logout failed');
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return null; // No token, not authenticated
    }
    
    const response = await fetch(`${API_BASE}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (response.status === 401) {
      // Token invalid or expired, clear it
      localStorage.removeItem('authToken');
      return null;
    }
    if (!response.ok) {
      throw new Error('Failed to get user');
    }
    return response.json();
  } catch (error) {
    return null;
  }
};

// Admin API functions
export interface CreateUserRequest {
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

export const createUser = async (userData: CreateUserRequest): Promise<{ message: string; user: User }> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/admin/create-user`, {
    method: 'POST',
    headers,
    body: JSON.stringify(userData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create user');
  }
  return response.json();
};

export const getAllUsers = async (): Promise<User[]> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/admin/users`, {
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
};

export const toggleUserStatus = async (userId: string): Promise<{ message: string; user: User }> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/admin/toggle-user-status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to toggle user status');
  }
  return response.json();
};

export const updateUserRole = async (userId: string, role: 'admin' | 'user'): Promise<{ message: string; user: User }> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/admin/elevate-user`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, role }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update user role');
  }
  return response.json();
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
  const response = await authenticatedFetch(`${API_BASE}/styles`);
  if (!response.ok) {
    throw new Error('Failed to fetch image styles');
  }
  return response.json();
};

export const getImageStyle = async (id: string): Promise<ImageStyle> => {
  const response = await authenticatedFetch(`${API_BASE}/styles/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch image style');
  }
  return response.json();
};

export const createImageStyle = async (style: { 
  name: string; 
  stylePrompt: string; 
  description?: string;
  isAiExtracted?: boolean;
  referenceImageUrl?: string;
  extractionPrompt?: string;
  conceptPrompt?: string;
  generatedConcept?: string;
  aiStyleData?: any;
  previewImageUrl?: string;
}): Promise<ImageStyle> => {
  const response = await authenticatedFetch(`${API_BASE}/styles`, {
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
  const response = await authenticatedFetch(`${API_BASE}/styles/${id}`, {
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
  const response = await authenticatedFetch(`${API_BASE}/styles/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete image style');
  }
};

export const duplicateImageStyle = async (id: string): Promise<ImageStyle> => {
  const response = await authenticatedFetch(`${API_BASE}/styles/${id}/duplicate`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to duplicate image style');
  }
  return response.json();
};

// Generation Job API
export const startGeneration = async (request: GenerationRequest): Promise<GenerationResponse> => {
  const response = await authenticatedFetch(`${API_BASE}/generate`, {
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
  const response = await authenticatedFetch(`${API_BASE}/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch generation job');
  }
  return response.json();
};

export const getGeneratedImages = async (jobId: string): Promise<GeneratedImage[]> => {
  const response = await authenticatedFetch(`${API_BASE}/jobs/${jobId}/images`);
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
  const response = await authenticatedFetch('/api/sessions');
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
};

export const getProjectSessionById = async (id: string) => {
  const response = await authenticatedFetch(`/api/sessions/${id}`);
  if (!response.ok) {
    // Try to extract detailed error from response
    let errorMessage = 'Failed to fetch session';
    try {
      const errorData = await response.json();
      errorMessage = errorData.details || errorData.error || errorMessage;
    } catch (parseError) {
      // JSON parsing failed, use generic message
    }
    throw new Error(errorMessage);
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
  const response = await authenticatedFetch('/api/sessions', {
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
  const response = await authenticatedFetch(`/api/sessions/${id}`, {
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
  const response = await authenticatedFetch(`/api/sessions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete session');
  }
};


export const clearTemporarySessions = async () => {
  const response = await authenticatedFetch('/api/sessions/temporary', {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to clear temporary sessions');
  }
};

export const getGeneratedImagesBySessionId = async (sessionId: string): Promise<GeneratedImage[]> => {
  const response = await authenticatedFetch(`${API_BASE}/sessions/${sessionId}/images`);
  if (!response.ok) {
    // Try to extract detailed error from response
    let errorMessage = 'Failed to fetch session images';
    try {
      const errorData = await response.json();
      errorMessage = errorData.details || errorData.error || errorMessage;
    } catch (parseError) {
      // JSON parsing failed, use generic message
    }
    throw new Error(errorMessage);
  }
  return response.json();
};

export const migrateGenerationJobsToSession = async (targetSessionId: string, sourceSessionId: string) => {
  const response = await authenticatedFetch(`${API_BASE}/sessions/${targetSessionId}/migrate-jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sourceSessionId }),
  });

  if (!response.ok) {
    throw new Error('Failed to migrate generation jobs to session');
  }

  return response.json();
};

export const getTemporarySessionsForUser = async (): Promise<ProjectSession[]> => {
  const response = await authenticatedFetch(`${API_BASE}/sessions/temporary`);
  if (!response.ok) {
    throw new Error('Failed to fetch temporary sessions');
  }
  return response.json();
};

export const getWorkingSession = async () => {
  const response = await authenticatedFetch('/api/sessions/working');
  if (!response.ok) {
    throw new Error('Failed to get working session');
  }
  return response.json();
};

// User Preferences API
export interface UserPreferences {
  id: string;
  userId: string;
  defaultExtractionPrompt: string | null;
  defaultConceptPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferencesRequest {
  defaultExtractionPrompt: string;
  defaultConceptPrompt: string;
}

export const getUserPreferences = async (): Promise<UserPreferences | null> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/preferences`, {
    headers,
  });
  if (response.status === 404) {
    return null; // No preferences set yet
  }
  if (!response.ok) {
    throw new Error('Failed to get user preferences');
  }
  return response.json();
};

export const updateUserPreferences = async (preferences: UpdatePreferencesRequest): Promise<UserPreferences> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}/preferences`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(preferences),
  });
  if (!response.ok) {
    throw new Error('Failed to update user preferences');
  }
  return response.json();
};

// System Prompts API
export const getAllSystemPrompts = async (): Promise<SystemPrompt[]> => {
  const response = await authenticatedFetch(`${API_BASE}/prompts`);
  if (!response.ok) {
    throw new Error('Failed to fetch system prompts');
  }
  return response.json();
};

export const getSystemPromptsByCategory = async (category: 'style_extraction' | 'concept_generation'): Promise<SystemPrompt[]> => {
  const response = await authenticatedFetch(`${API_BASE}/prompts?category=${category}`);
  if (!response.ok) {
    throw new Error('Failed to fetch system prompts by category');
  }
  return response.json();
};

export const getDefaultSystemPrompt = async (category: 'style_extraction' | 'concept_generation'): Promise<SystemPrompt | null> => {
  const response = await authenticatedFetch(`${API_BASE}/prompts/default/${category}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch default system prompt');
  }
  return response.json();
};

export const getSystemPromptById = async (id: string): Promise<SystemPrompt> => {
  const response = await authenticatedFetch(`${API_BASE}/prompts/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch system prompt');
  }
  return response.json();
};

export const createSystemPrompt = async (prompt: { name: string; promptText: string; category: 'style_extraction' | 'concept_generation'; description?: string; isDefault?: boolean }): Promise<SystemPrompt> => {
  const response = await authenticatedFetch(`${API_BASE}/prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });
  if (!response.ok) {
    throw new Error('Failed to create system prompt');
  }
  return response.json();
};

export const updateSystemPrompt = async (id: string, prompt: Partial<{ name: string; promptText: string; description?: string; isDefault?: boolean }>): Promise<SystemPrompt> => {
  const response = await authenticatedFetch(`${API_BASE}/prompts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });
  if (!response.ok) {
    throw new Error('Failed to update system prompt');
  }
  return response.json();
};

export const deleteSystemPrompt = async (id: string): Promise<void> => {
  const response = await authenticatedFetch(`${API_BASE}/prompts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete system prompt');
  }
};

// Concept List API

export const getConceptLists = async (): Promise<ConceptList[]> => {
  const response = await authenticatedFetch(`${API_BASE}/concept-lists`);
  if (!response.ok) {
    throw new Error('Failed to fetch concept lists');
  }
  return response.json();
};

export const getConceptListById = async (id: string): Promise<ConceptList> => {
  const response = await authenticatedFetch(`${API_BASE}/concept-lists/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch concept list');
  }
  return response.json();
};

export const generateConceptList = async (data: {
  name?: string;
  companyName: string;
  referenceImageUrl?: string;
  marketingContent: string;
  promptId?: string;
  promptText?: string;
  quantity?: number;
  temperature?: number;
  literalMetaphorical?: number;
  simpleComplex?: number;
}): Promise<ConceptList> => {
  const response = await authenticatedFetch(`${API_BASE}/generate-concept-list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to generate concept list');
  }
  return response.json();
};

export const updateConceptList = async (id: string, updates: {
  name?: string;
  concepts?: Concept[];
  marketingContent?: string;
}): Promise<ConceptList> => {
  const response = await authenticatedFetch(`${API_BASE}/concept-lists/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update concept list');
  }
  return response.json();
};

export const reviseConceptList = async (id: string, feedback: string): Promise<ConceptList> => {
  const response = await authenticatedFetch(`${API_BASE}/concept-lists/${id}/revise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feedback }),
  });
  if (!response.ok) {
    throw new Error('Failed to revise concept list');
  }
  return response.json();
};

export const deleteConceptList = async (id: string): Promise<void> => {
  const response = await authenticatedFetch(`${API_BASE}/concept-lists/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete concept list');
  }
};