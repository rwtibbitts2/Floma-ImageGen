import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import StyleSelector from '@/components/StyleSelector';
import VisualConceptsInput from '@/components/VisualConceptsInput';
import GenerationSettings from '@/components/GenerationSettings';
import BatchProgressTracker from '@/components/BatchProgressTracker';
import ResultsGallery from '@/components/ResultsGallery';
import GenerationControl from '@/components/GenerationControl';
import { ImageStyle, GenerationSettings as GenerationSettingsType, GeneratedImage } from '@shared/schema';

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
    quality: 'standard',
    size: '1024x1024',
    style: 'vivid',
    variations: 1,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentConcept, setCurrentConcept] = useState<string>();

  // Mock functions for demonstration - todo: remove mock functionality
  const handleStartGeneration = (jobName: string) => {
    console.log('Starting generation:', { jobName, selectedStyle, concepts, settings });
    setIsGenerating(true);
    setCurrentProgress(0);
    
    // Simulate generation progress
    const totalImages = concepts.length * settings.variations;
    let completed = 0;
    
    const generateImage = () => {
      if (completed < totalImages) {
        const conceptIndex = Math.floor(completed / settings.variations);
        const currentConceptText = concepts[conceptIndex];
        setCurrentConcept(currentConceptText);
        
        // Simulate image generation delay
        setTimeout(() => {
          completed++;
          setCurrentProgress(completed);
          
          // Add mock generated image
          const newImage: GeneratedImage = {
            id: `img-${completed}`,
            jobId: 'job-1',
            visualConcept: currentConceptText,
            imageUrl: `https://picsum.photos/400/400?random=${completed}`,
            prompt: `${currentConceptText}, ${selectedStyle?.stylePrompt}`,
            status: 'completed',
            createdAt: new Date(),
          };
          
          setGeneratedImages(prev => [...prev, newImage]);
          
          if (completed < totalImages) {
            generateImage();
          } else {
            setIsGenerating(false);
            setCurrentConcept(undefined);
          }
        }, 2000);
      }
    };
    
    generateImage();
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

  const totalImages = concepts.length * settings.variations;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
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
          <main className="flex-1 overflow-hidden p-6">
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Left Column - Configuration */}
              <div className="col-span-4 space-y-6 overflow-y-auto">
                <StyleSelector
                  selectedStyle={selectedStyle}
                  onStyleSelect={setSelectedStyle}
                  onUploadStyle={() => console.log('Upload style clicked')}
                />
                
                <GenerationSettings
                  settings={settings}
                  onSettingsChange={setSettings}
                />
                
                <GenerationControl
                  selectedStyle={selectedStyle}
                  concepts={concepts}
                  settings={settings}
                  isRunning={isGenerating}
                  onStartGeneration={handleStartGeneration}
                  onSaveProject={(jobName) => console.log('Save project:', jobName)}
                />
              </div>

              {/* Middle Column - Visual Concepts */}
              <div className="col-span-4 space-y-6 overflow-y-auto">
                <VisualConceptsInput
                  concepts={concepts}
                  onConceptsChange={setConcepts}
                  onUploadFile={() => console.log('Upload concepts file clicked')}
                />
                
                {/* Progress when generating */}
                {(isGenerating || currentProgress > 0) && (
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
                )}
              </div>

              {/* Right Column - Results */}
              <div className="col-span-4 overflow-y-auto">
                <ResultsGallery
                  images={generatedImages}
                  onDownload={handleDownloadImage}
                  onDownloadAll={handleDownloadAll}
                  onDelete={(imageId) => {
                    setGeneratedImages(prev => prev.filter(img => img.id !== imageId));
                    console.log('Deleted image:', imageId);
                  }}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}