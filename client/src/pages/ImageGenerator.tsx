import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import StyleSelector from '@/components/StyleSelector';
import VisualConceptsInput from '@/components/VisualConceptsInput';
import GenerationSettings from '@/components/GenerationSettings';
import BatchProgressTracker from '@/components/BatchProgressTracker';
import GenerationSummaryAction from '@/components/GenerationSummaryAction';
import PersistentImageGallery from '@/components/PersistentImageGallery';
import AddStyleModal from '@/components/AddStyleModal';
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

  const handleDownloadImage = (image: GeneratedImage) => {
    console.log('Downloading image:', image.visualConcept);
    // In real app, would trigger download
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
              <h1 className="text-xl font-semibold">Image Generator</h1>
            </div>
            <ThemeToggle />
          </header>

          {/* Main Layout */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col h-full space-y-6">
              {/* Two columns */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 min-h-0">
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
                  onSaveProject={() => console.log('Save project')}
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
                  console.log('Image clicked:', image.visualConcept);
                  // Could open full-size view in future
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
      </div>
    </SidebarProvider>
  );
}