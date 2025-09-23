import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { Moon, Sun, ArrowLeft, Download, ExternalLink } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import SaveSessionModal from '@/components/SaveSessionModal';
import { ImageStyle, GenerationSettings as GenerationSettingsType, GeneratedImage, GenerationJob } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  
  // State management
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>();
  const [concepts, setConcepts] = useState<string[]>([]);
  const [settings, setSettings] = useState<GenerationSettingsType>({
    model: 'dall-e-3',
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<GeneratedImage | null>(null);

  const { toast } = useToast();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  
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
    
    // Update session when generation starts
    await updateSessionOnStart();
    
    try {
      setIsGenerating(true);
      setCurrentProgress(0);
      setGeneratedImages([]);
      
      console.log('Starting generation:', { selectedStyle, concepts, settings });
      
      const response = await api.startGeneration({
        jobName: `Generation ${new Date().toLocaleTimeString()}`,
        styleId: selectedStyle.id,
        concepts,
        settings
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
            setCurrentConcept(processingImages[0].visualConcept);
          }
        },
        (job, images) => {
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
          
          const completedCount = completedImages.length;
          const failedCount = images.filter(img => img.status === 'failed').length;
          
          toast({
            title: job.status === 'completed' ? 'Generation Complete' : 'Generation Failed',
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

  // Save functionality
  const handleSaveProject = () => {
    setShowSaveModal(true);
  };

  const handleSaveComplete = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setHasUnsavedChanges(false);
    setShowSaveModal(false);
  };

  // Autosave functionality - trigger after generation completion
  const performAutosave = async () => {
    if (!concepts.length) return;

    try {
      const timestamp = new Date().toLocaleString();
      const sessionData = {
        displayName: `Autosave - ${timestamp}`,
        styleId: selectedStyle?.id,
        visualConcepts: concepts,
        settings,
        isTemporary: true,
        hasUnsavedChanges: false
      };

      await api.createProjectSession(sessionData);
      console.log('Autosave completed:', timestamp);
    } catch (error) {
      console.error('Autosave failed:', error);
    }
  };

  // Load session from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const sessionId = urlParams.get('session');
    
    if (sessionId && sessionId !== currentSessionId) {
      console.log('Loading session:', sessionId);
      
      const loadSession = async () => {
        try {
          // Load session and styles in parallel
          const [session, styles] = await Promise.all([
            api.getProjectSessionById(sessionId),
            api.getImageStyles()
          ]);
          
          console.log('Session loaded:', session);
          console.log('Available styles:', styles);
          
          // Set session ID first to avoid re-triggering
          setCurrentSessionId(sessionId);
          
          // Find and set the style if it exists
          if (session.styleId) {
            const style = styles.find(s => s.id === session.styleId);
            console.log('Found style:', style);
            setSelectedStyle(style);
          }
          
          // Set concepts and settings
          setConcepts(session.visualConcepts || []);
          setSettings(session.settings || settings);
          setHasUnsavedChanges(false); // This is a loaded session
          
          toast({
            title: 'Session Loaded',
            description: `Loaded "${session.displayName}"`,
          });
          
        } catch (error) {
          console.error('Failed to load session:', error);
          toast({
            title: 'Load Failed',
            description: 'Failed to load the selected session.',
            variant: 'destructive'
          });
        }
      };
      
      loadSession();
    }
  }, [location, currentSessionId]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [selectedStyle, concepts, settings]);

  // Create temporary session on first changes
  const createTemporarySession = async () => {
    if (currentSessionId) return; // Already have a session
    
    try {
      const session = await api.createProjectSession({
        displayName: `Autosave ${new Date().toLocaleString()}`,
        styleId: selectedStyle?.id,
        visualConcepts: concepts,
        settings,
        isTemporary: true,
        hasUnsavedChanges: true
      });
      
      setCurrentSessionId(session.id);
      console.log('Created temporary session:', session.id);
    } catch (error) {
      console.error('Failed to create temporary session:', error);
    }
  };

  // Update session when generation starts
  const updateSessionOnStart = async () => {
    if (!currentSessionId) {
      await createTemporarySession();
    } else {
      try {
        await api.updateProjectSession(currentSessionId, {
          styleId: selectedStyle?.id,
          visualConcepts: concepts,
          settings,
          hasUnsavedChanges: true
        });
        console.log('Updated session on generation start');
      } catch (error) {
        console.error('Failed to update session:', error);
      }
    }
  };

  // Autosave after each generation job completes
  useEffect(() => {
    if (currentJob?.status === 'completed' && concepts.length > 0) {
      performAutosave();
    }
  }, [currentJob?.status, concepts, selectedStyle, settings]);

  // Navigation guard for back to home
  const handleBackToHome = () => {
    if (hasUnsavedChanges && concepts.length > 0) {
      setShowLeaveDialog(true);
      return;
    }
    setLocation('/');
  };

  const confirmLeave = () => {
    setShowLeaveDialog(false);
    setLocation('/');
  };

  const cancelLeave = () => {
    setShowLeaveDialog(false);
  };

  // Warning for unsaved changes before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && concepts.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, concepts.length]);

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Main Content */}
        <div className="flex flex-col flex-1">
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
              {hasUnsavedChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                  data-testid="button-save-session"
                >
                  Save Session
                </Button>
              )}
              <ThemeToggle />
            </div>
          </header>

          {/* Main Layout */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col space-y-3">
              {/* Two columns */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Column (33%) - Style + Settings */}
                <div className="md:col-span-4 space-y-6">
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

                {/* Right Column (66%) - Visual Concepts or Progress */}
                <div className="md:col-span-8 space-y-6">
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
                    <VisualConceptsInput
                      concepts={concepts}
                      onConceptsChange={setConcepts}
                      onUploadFile={handleUploadConceptsFile}
                    />
                  )}
                </div>
              </div>
              
              {/* Bottom Row - Generation Summary and Action (full width) */}
              <div className="w-full">
                <GenerationSummaryAction
                  selectedStyle={selectedStyle}
                  concepts={concepts}
                  settings={settings}
                  isRunning={isGenerating}
                  onStartGeneration={handleStartGeneration}
                  onSaveProject={handleSaveProject}
                />
              </div>
            </div>
            
            {/* Persistent Session Gallery - Always at bottom, full width */}
            <div className="w-full mt-6">
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

        {/* Save Session Modal */}
        <SaveSessionModal
          open={showSaveModal}
          onOpenChange={setShowSaveModal}
          onSaveComplete={handleSaveComplete}
          selectedStyle={selectedStyle}
          concepts={concepts}
          settings={settings}
        />

        {/* Leave confirmation dialog */}
        <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to leave? Your work will be lost unless you save first.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelLeave} data-testid="button-cancel-leave">
                Stay
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmLeave} data-testid="button-confirm-leave">
                Leave Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Image Zoom Modal */}
        <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{zoomedImage?.visualConcept}</DialogTitle>
            </DialogHeader>
            {zoomedImage && (
              <div className="space-y-4">
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <img
                    src={zoomedImage.imageUrl}
                    alt={zoomedImage.visualConcept}
                    className="w-full h-full object-contain"
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