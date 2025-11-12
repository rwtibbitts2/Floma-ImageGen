import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { Moon, Sun, ArrowLeft, Download, ExternalLink, LogOut, Settings2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import StyleSelector from '@/components/StyleSelector';
import VisualConceptsInput from '@/components/VisualConceptsInput';
import GenerationSettings from '@/components/GenerationSettings';
import BatchProgressTracker from '@/components/BatchProgressTracker';
import GenerationSummaryAction from '@/components/GenerationSummaryAction';
import PersistentImageGallery from '@/components/PersistentImageGallery';
import AddStyleModal from '@/components/AddStyleModal';
import RegenerateModal from '@/components/RegenerateModal';
import { ImageStyle, GenerationSettings as GenerationSettingsType, GeneratedImage, GenerationJob, ProjectSession } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { conceptToDisplayString } from '@shared/utils';

// ThemeToggle component
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark', !isDark);
    console.log('Theme toggled to:', !isDark ? 'dark' : 'light');
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default function ImageGenerator() {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();
  
  // State management
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>();
  const [concepts, setConcepts] = useState<string[]>([]);
  const [settings, setSettings] = useState<GenerationSettingsType>({
    model: 'gpt-image-1',
    quality: 'standard',
    size: '1024x1024',
    transparency: false,
    variations: 1,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [sessionImages, setSessionImages] = useState<GeneratedImage[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentConcept, setCurrentConcept] = useState<string>();
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<ImageStyle>();
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [currentSession, setCurrentSession] = useState<ProjectSession>();
  const [zoomedImage, setZoomedImage] = useState<GeneratedImage | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [regenerateImage, setRegenerateImage] = useState<GeneratedImage | null>(null);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [activeRegenerationJobs, setActiveRegenerationJobs] = useState<Set<string>>(new Set());
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  const { toast } = useToast();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  
  // Detect viewport width for responsive design
  useEffect(() => {
    const checkViewportWidth = () => {
      setIsNarrowViewport(window.innerWidth < 1000);
    };
    
    checkViewportWidth();
    window.addEventListener('resize', checkViewportWidth);
    
    return () => window.removeEventListener('resize', checkViewportWidth);
  }, []);
  
  // Fetch image styles from API
  const { data: apiStyles = [], isLoading: stylesLoading } = useQuery({
    queryKey: ['imageStyles'],
    queryFn: api.getImageStyles
  });
  
  // Real image generation function
  const handleStartGeneration = async () => {
    if (!selectedStyle || concepts.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select a style and add visual concepts',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setIsGenerating(true);
      setCurrentProgress(0);
      setGeneratedImages([]);
      
      console.log('Starting generation:', { selectedStyle, concepts, settings, sessionId: currentSessionId });
      
      const response = await api.startGeneration({
        jobName: `Generation ${new Date().toLocaleTimeString()}`,
        styleId: selectedStyle.id,
        concepts,
        settings,
        sessionId: currentSessionId // Link generation to current session for image persistence only if one exists
      });
      
      setCurrentJobId(response.jobId);
      
      toast({
        title: 'Generation Started',
        description: 'Your batch generation has started. You\'ll see progress updates below.'
      });
      
      // Start polling for progress
      api.pollGenerationProgress(
        response.jobId,
        (job, images) => {
          setCurrentJob(job);
          const completedImages = images.filter(img => img.status === 'completed');
          setCurrentProgress(completedImages.length);
          setGeneratedImages(completedImages);
          
          // Add new completed images to session gallery
          setSessionImages(prev => {
            const newImages = completedImages.filter(img => 
              !prev.some(existing => existing.id === img.id)
            );
            return [...prev, ...newImages];
          });
          
          // Update current concept being processed
          const processingImages = images.filter(img => img.status === 'generating');
          if (processingImages.length > 0) {
            const concept = processingImages[0].visualConcept;
            // Convert concept object to string for display
            if (typeof concept === 'string') {
              setCurrentConcept(concept);
            } else {
              setCurrentConcept(conceptToDisplayString(concept));
            }
          }
        },
        async (job, images) => {
          setCurrentJob(job);
          setIsGenerating(false);
          setCurrentConcept(undefined);
          const completedImages = images.filter(img => img.status === 'completed');
          setGeneratedImages(completedImages);
          
          // Add final completed images to session gallery
          setSessionImages(prev => {
            const newImages = completedImages.filter(img => 
              !prev.some(existing => existing.id === img.id)
            );
            return [...prev, ...newImages];
          });
          
          // Auto-save after generation completes and convert working session to saved session
          if (currentSessionId && job.status === 'completed') {
            try {
              // Check if this is a working session (name is null) that should be converted to saved
              const isWorkingSession = !currentSession?.name;
              
              if (isWorkingSession) {
                // Convert working session to saved session with style name
                const displayName = selectedStyle?.name || 'Generated Images';
                
                const updatedSession = await api.updateProjectSession(currentSessionId, {
                  name: displayName, // Set name to make it a saved session
                  displayName: displayName, // Set display name for UI
                  styleId: selectedStyle?.id,
                  visualConcepts: concepts,
                  settings,
                  isTemporary: false,
                  hasUnsavedChanges: false
                });
                
                // Update local session state to reflect the changes
                setCurrentSession(updatedSession);
                
                // Invalidate sessions cache to update homepage
                queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
                
                console.log('Converted working session to saved session:', displayName);
              } else {
                // For existing saved sessions, only update content, not name/display name
                await api.updateProjectSession(currentSessionId, {
                  styleId: selectedStyle?.id,
                  visualConcepts: concepts,
                  settings
                });
                console.log('Auto-saved existing saved session');
              }
            } catch (error) {
              console.error('Auto-save after generation failed:', error);
            }
          }
          
          const completedCount = completedImages.length;
          const failedCount = images.filter(img => img.status === 'failed').length;
          
          toast({
            title: job.status === 'completed' ? 'Images Generated & Saved' : 'Generation Failed',
            description: `Generated ${completedCount} images successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
            variant: job.status === 'completed' ? 'default' : 'destructive'
          });
        },
        (error) => {
          console.error('Generation polling error:', error);
          setIsGenerating(false);
          setCurrentConcept(undefined);
          
          toast({
            title: 'Generation Error', 
            description: 'Failed to track generation progress. Please refresh the page.',
            variant: 'destructive'
          });
        }
      );
      
    } catch (error) {
      console.error('Failed to start generation:', error);
      setIsGenerating(false);
      
      toast({
        title: 'Generation Failed',
        description: 'Failed to start image generation. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handlePauseGeneration = () => {
    console.log('Generation paused');
    setIsGenerating(false);
  };

  const handleResumeGeneration = () => {
    console.log('Generation resumed');
    setIsGenerating(true);
  };

  const handleStopGeneration = () => {
    console.log('Generation stopped');
    setIsGenerating(false);
    setCurrentProgress(0);
    setCurrentConcept(undefined);
  };

  const handleDownloadImage = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${image.visualConcept.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Download Started',
        description: `Downloading "${image.visualConcept}"`
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: 'Could not download the image. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleDownloadAll = () => {
    console.log('Downloading all images');
    // In real app, would create zip file and download
  };

  const handleOpenStyleModal = () => {
    setEditingStyle(undefined);
    setIsStyleModalOpen(true);
  };

  const handleEditStyle = (style: ImageStyle) => {
    setEditingStyle(style);
    setIsStyleModalOpen(true);
  };

  const handleCloseStyleModal = () => {
    setIsStyleModalOpen(false);
    setEditingStyle(undefined);
  };



  // Load session from URL parameter OR load working session
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    
    if (sessionId && sessionId !== currentSessionId) {
      // Load specific session from URL
      console.log('Loading session:', sessionId);
      
      const loadSession = async () => {
        setIsLoadingSession(true);
        setSessionImages([]); // Clear old images immediately
        
        try {
          // Load session and styles first (fast operations)
          const [session, styles] = await Promise.all([
            api.getProjectSessionById(sessionId),
            api.getImageStyles()
          ]);
          
          console.log('Session loaded:', session);
          console.log('Available styles:', styles);
          
          // Set session ID and session data first to avoid re-triggering
          setCurrentSessionId(sessionId);
          setCurrentSession(session);
          
          // Find and set the style if it exists
          if (session.styleId) {
            const style = styles.find(s => s.id === session.styleId);
            console.log('Found style:', style);
            setSelectedStyle(style);
          }
          
          // Set concepts and settings
          setConcepts(session.visualConcepts || []);
          setSettings(session.settings || settings);
          
          setIsLoadingSession(false);
          
          // Load images in the background (non-blocking)
          api.getGeneratedImagesBySessionId(sessionId)
            .then(sessionImages => {
              console.log('Session images loaded:', sessionImages);
              setSessionImages(sessionImages);
              toast({
                title: 'Session Loaded',
                description: `Loaded "${session.displayName}" with ${sessionImages.length} saved images`,
              });
            })
            .catch(error => {
              console.error('Failed to load session images:', error);
              // Don't show error toast - session is already loaded
              setSessionImages([]);
            });
          
        } catch (error) {
          console.error('Failed to load session:', error);
          
          // Try to extract more detailed error message
          let errorMessage = 'Failed to load the selected session.';
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          
          toast({
            title: 'Load Failed',
            description: errorMessage,
            variant: 'destructive'
          });
          setIsLoadingSession(false);
        }
      };
      
      loadSession();
    } else if (!sessionId && !currentSessionId) {
      // Load or create working session when no specific session in URL
      console.log('Loading working session');
      
      const loadWorkingSession = async () => {
        setIsLoadingSession(true);
        setSessionImages([]); // Clear old images immediately
        
        try {
          const [workingSession, styles] = await Promise.all([
            api.getWorkingSession(),
            api.getImageStyles()
          ]);
          
          console.log('Working session loaded:', workingSession);
          
          // Set session ID and session data first to avoid re-triggering
          setCurrentSessionId(workingSession.id);
          setCurrentSession(workingSession);
          
          // Find and set the style if it exists
          if (workingSession.styleId) {
            const style = styles.find(s => s.id === workingSession.styleId);
            setSelectedStyle(style);
          }
          
          // Set concepts and settings
          setConcepts(workingSession.visualConcepts || []);
          setSettings(workingSession.settings || settings);
          
          setIsLoadingSession(false);
          
          // Load images in the background (non-blocking)
          api.getGeneratedImagesBySessionId(workingSession.id)
            .then(sessionImages => {
              console.log('Working session ready with', sessionImages.length, 'images');
              setSessionImages(sessionImages);
            })
            .catch(error => {
              console.error('Failed to load session images:', error);
              setSessionImages([]);
            });
          
        } catch (error) {
          console.error('Failed to load working session:', error);
          toast({
            title: 'Setup Failed',
            description: 'Failed to initialize your workspace.',
            variant: 'destructive'
          });
          setIsLoadingSession(false);
        }
      };
      
      loadWorkingSession();
    }
  }, [location, currentSessionId]);

  // Auto-save changes to working session
  useEffect(() => {
    // Auto-save changes to the working session
    // Don't trigger during session loading to avoid false saves
    if (isLoadingSession || !currentSessionId) return;
    
    const autoSave = async () => {
      try {
        await api.updateProjectSession(currentSessionId, {
          styleId: selectedStyle?.id,
          visualConcepts: concepts,
          settings
        });
        console.log('Auto-saved changes to working session');
      } catch (error) {
        console.error('Auto-save failed:', error);
        // Don't show toast for auto-save failures as they're non-critical
      }
    };
    
    // Debounce auto-save to avoid too many calls
    const timeoutId = setTimeout(autoSave, 1000);
    return () => clearTimeout(timeoutId);
  }, [selectedStyle, concepts, settings, currentSessionId, isLoadingSession]);

  // Navigation guard for back to home
  const handleBackToHome = () => {
    setLocation('/');
  };


  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
    } catch (error) {
      toast({
        title: 'Logout failed',
        description: 'There was an error logging you out.',
        variant: 'destructive'
      });
    }
  };

  const handleRegenerate = (image: GeneratedImage) => {
    setRegenerateImage(image);
    setIsRegenerateModalOpen(true);
  };

  const handleRegenerationStarted = (jobId: string) => {
    setActiveRegenerationJobs(prev => new Set(prev).add(jobId));
    
    // Polling function that closes over jobId - will recursively call itself
    const pollRegenerationJob = async (): Promise<void> => {
      try {
        // Fetch job status using authenticated API
        const job = await api.getGenerationJob(jobId);
        
        if (job.status === 'completed' || job.status === 'failed') {
          // Job finished - remove from active jobs set
          setActiveRegenerationJobs(prev => {
            const newSet = new Set(prev);
            newSet.delete(jobId);
            return newSet;
          });
          
          if (job.status === 'completed') {
            // Fetch the regenerated images for this job
            let completedImagesCount = 0;
            try {
              const images = await api.getGeneratedImages(jobId);
              const completedImages = images.filter((img: any) => img.status === 'completed');
              completedImagesCount = completedImages.length;
              
              // Add new regenerated images to session gallery (same pattern as regular generation)
              setSessionImages(prev => {
                const newImages = completedImages.filter((img: any) => 
                  !prev.some(existing => existing.id === img.id)
                );
                return [...prev, ...newImages];
              });
              
              console.log('Added', completedImages.length, 'regenerated images to session gallery');
            } catch (imagesError) {
              console.error('Failed to fetch regenerated images:', imagesError);
            }
            
            // Show success only if at least one image was successfully regenerated
            if (completedImagesCount > 0) {
              toast({
                title: 'Regeneration Complete',
                description: 'Your regenerated image is now available in the gallery.',
              });
            } else {
              toast({
                title: 'Regeneration Failed',
                description: 'The image regeneration was unsuccessful. Please try again.',
                variant: 'destructive'
              });
            }
          } else {
            // Job failed
            toast({
              title: 'Regeneration Failed',
              description: 'The image regeneration was unsuccessful.',
              variant: 'destructive'
            });
          }
          
          // Stop polling - job is complete
          return;
        }
        
        // Job is still running - schedule next poll in 2 seconds
        // pollRegenerationJob captures jobId via closure, so it will poll the same job
        setTimeout(pollRegenerationJob, 2000);
        
      } catch (error) {
        console.error('Error polling regeneration job:', error);
        
        // Remove from active jobs on error to prevent stuck state
        setActiveRegenerationJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
        
        // Show error toast
        toast({
          title: 'Regeneration Error',
          description: 'Failed to check regeneration status. Please try again.',
          variant: 'destructive'
        });
      }
    };
    
    // Start polling after initial 1 second delay
    setTimeout(pollRegenerationJob, 1000);
  };


  const handleUploadConceptsFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const conceptsData = JSON.parse(event.target?.result as string);
            if (Array.isArray(conceptsData) && conceptsData.every(item => typeof item === 'string')) {
              setConcepts(conceptsData);
              toast({
                title: 'Concepts Uploaded',
                description: `Successfully loaded ${conceptsData.length} visual concepts.`,
              });
            } else {
              toast({
                title: 'Invalid Format',
                description: 'File must contain an array of strings.',
                variant: 'destructive'
              });
            }
          } catch (error) {
            toast({
              title: 'Invalid File',
              description: 'Please upload a valid JSON file.',
              variant: 'destructive'
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const totalImages = concepts.length * settings.variations;
  
  // Component for Style and Settings (used in both desktop and mobile layouts)
  const StyleAndSettings = () => (
    <div className="space-y-6">
      <StyleSelector
        selectedStyle={selectedStyle}
        onStyleSelect={setSelectedStyle}
        onUploadStyle={handleOpenStyleModal}
        onEditStyle={handleEditStyle}
        styles={apiStyles}
        isLoading={stylesLoading}
      />
      
      <GenerationSettings
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        {/* Main Content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToHome}
                data-testid="button-back-home"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
              <h1 className="text-xl font-semibold">Image Generator</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Settings trigger for narrow viewports */}
              {isNarrowViewport && (
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="button-settings-drawer"
                    >
                      <Settings2 className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85vw] max-w-sm sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Image Style & Generation Settings</SheetTitle>
                      <SheetDescription>
                        Configure your image style and generation parameters.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                      <StyleAndSettings />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
              <ThemeToggle />
            </div>
          </header>

          {/* Main Layout */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 min-w-0">
            <div className="flex flex-col space-y-3 w-full max-w-full">
              {/* Responsive Layout */}
              {isNarrowViewport ? (
                /* Mobile Layout - Single column */
                <div className="space-y-6 w-full max-w-full">
                  {/* Visual Concepts and Progress take full width */}
                  <div className="w-full">
                    {/* Show progress tracker during active generation states, otherwise show visual concepts input */}
                    {(currentJob?.status === 'running' || currentJob?.status === 'pending' || isGenerating) ? (
                      <BatchProgressTracker
                        totalConcepts={concepts.length}
                        totalVariations={settings.variations}
                        completedImages={currentProgress}
                        failedImages={0}
                        currentConcept={currentConcept}
                        isRunning={isGenerating}
                        onPause={handlePauseGeneration}
                        onResume={handleResumeGeneration}
                        onStop={handleStopGeneration}
                        recentImages={generatedImages.slice(-4)}
                      />
                    ) : (
                      <>
                        <VisualConceptsInput
                          concepts={concepts}
                          onConceptsChange={setConcepts}
                          onUploadFile={handleUploadConceptsFile}
                          selectedStyle={selectedStyle}
                        />
                        
                        <GenerationSummaryAction
                          selectedStyle={selectedStyle}
                          concepts={concepts}
                          settings={settings}
                          isRunning={isGenerating}
                          onStartGeneration={handleStartGeneration}
                        />
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Desktop Layout - Two columns */
                <div className="grid grid-cols-12 gap-6 w-full max-w-full">
                  {/* Left Column (33%) - Style + Settings */}
                  <div className="col-span-4 space-y-6 min-w-0">
                    <StyleAndSettings />
                  </div>

                  {/* Right Column (66%) - Visual Concepts or Progress */}
                  <div className="col-span-8 space-y-6 min-w-0">
                    {/* Show progress tracker during active generation states, otherwise show visual concepts input */}
                    {(currentJob?.status === 'running' || currentJob?.status === 'pending' || isGenerating) ? (
                      <BatchProgressTracker
                        totalConcepts={concepts.length}
                        totalVariations={settings.variations}
                        completedImages={currentProgress}
                        failedImages={0}
                        currentConcept={currentConcept}
                        isRunning={isGenerating}
                        onPause={handlePauseGeneration}
                        onResume={handleResumeGeneration}
                        onStop={handleStopGeneration}
                        recentImages={generatedImages.slice(-4)}
                      />
                    ) : (
                      <>
                        <VisualConceptsInput
                          concepts={concepts}
                          onConceptsChange={setConcepts}
                          onUploadFile={handleUploadConceptsFile}
                          selectedStyle={selectedStyle}
                        />
                        
                        <GenerationSummaryAction
                          selectedStyle={selectedStyle}
                          concepts={concepts}
                          settings={settings}
                          isRunning={isGenerating}
                          onStartGeneration={handleStartGeneration}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Persistent Session Gallery - Always at bottom, full width */}
            <div className="w-full max-w-full mt-6">
              <PersistentImageGallery
                images={sessionImages}
                onDownload={handleDownloadImage}
                onDelete={(imageId) => {
                  setSessionImages(prev => prev.filter(img => img.id !== imageId));
                  console.log('Deleted session image:', imageId);
                }}
                onImageClick={(image) => {
                  setZoomedImage(image);
                }}
                onRegenerate={handleRegenerate}
                isRegenerating={activeRegenerationJobs.size > 0}
              />
            </div>
          </main>
        </div>
        
        {/* Add Style Modal */}
        <AddStyleModal
          open={isStyleModalOpen}
          onOpenChange={handleCloseStyleModal}
          editingStyle={editingStyle}
        />

        {/* Regenerate Modal */}
        {currentSessionId && (
          <RegenerateModal
            image={regenerateImage}
            open={isRegenerateModalOpen}
            onOpenChange={setIsRegenerateModalOpen}
            sessionId={currentSessionId}
            onRegenerationStarted={handleRegenerationStarted}
          />
        )}

        {/* Image Zoom Modal */}
        <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{zoomedImage?.visualConcept}</DialogTitle>
            </DialogHeader>
            {zoomedImage && (
              <div className="space-y-4 overflow-y-auto">
                <div className="flex justify-center bg-muted rounded-lg overflow-hidden max-h-[60vh]">
                  <img
                    src={zoomedImage.imageUrl}
                    alt={zoomedImage.visualConcept}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <strong>Concept:</strong> {zoomedImage.visualConcept}
                  </div>
                  <div className="text-sm">
                    <strong>Full Prompt:</strong> {zoomedImage.prompt}
                  </div>
                  <div className="text-sm">
                    <strong>Generated:</strong> {zoomedImage.createdAt ? new Date(zoomedImage.createdAt).toLocaleString() : 'Unknown'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleDownloadImage(zoomedImage)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={() => window.open(zoomedImage.imageUrl, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}