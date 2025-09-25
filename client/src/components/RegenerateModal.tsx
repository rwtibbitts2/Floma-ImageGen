import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2 } from 'lucide-react';
import { GeneratedImage, GenerationSettings, generationSettingsSchema } from '@shared/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import GenerationSettingsComponent from '@/components/GenerationSettings';

interface RegenerateModalProps {
  image: GeneratedImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onRegenerationStarted?: (jobId: string) => void;
}

interface RegenerateRequest {
  sourceImageId: string;
  instruction?: string;
  sessionId: string;
  settings?: GenerationSettings;
  useOriginalAsReference: boolean;
}

export default function RegenerateModal({ image, open, onOpenChange, sessionId, onRegenerationStarted }: RegenerateModalProps) {
  const [instruction, setInstruction] = useState('');
  const [settings, setSettings] = useState<GenerationSettings>(() => 
    generationSettingsSchema.parse({
      model: 'gpt-image-1', // Use GPT Image 1 for regeneration
      quality: 'standard',
      size: '1024x1024',
      variations: 1,
      transparency: false
    })
  );
  const [hasSettingsChanged, setHasSettingsChanged] = useState(false);
  const [useOriginalAsReference, setUseOriginalAsReference] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const regenerateMutation = useMutation({
    mutationFn: async (data: RegenerateRequest) => {
      return apiRequest('POST', '/api/regenerate', data);
    },
    onSuccess: async (response) => {
      // Extract job ID from response
      const responseData = await response.json();
      const jobId = responseData.jobId;
      
      // Call the callback to start tracking this regeneration
      if (onRegenerationStarted && jobId) {
        onRegenerationStarted(jobId);
      }
      
      const description = instruction && instruction.trim().length > 0 
        ? 'Your image is being regenerated with the new instructions. We\'ll notify you when it\'s ready.'
        : 'Your image is being enhanced with the updated settings. We\'ll notify you when it\'s ready.';
        
      toast({
        title: 'Regeneration Started',
        description,
      });
      
      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'images'] });
      
      onOpenChange(false);
      setInstruction('');
    },
    onError: (error: any) => {
      toast({
        title: 'Regeneration Failed',
        description: error.message || 'Failed to start regeneration',
        variant: 'destructive',
      });
    },
  });

  const handleSettingsChange = (newSettings: GenerationSettings) => {
    setSettings(newSettings);
    setHasSettingsChanged(true);
  };

  const handleRegenerate = () => {
    if (!image) return;
    
    // Allow regeneration if either instruction is provided OR settings have changed
    const hasInstruction = instruction.trim().length > 0;
    if (!hasInstruction && !hasSettingsChanged) return;
    
    const requestData: RegenerateRequest = {
      sourceImageId: image.id,
      sessionId,
      useOriginalAsReference,
    };
    
    if (hasInstruction) {
      requestData.instruction = instruction.trim();
    }
    
    if (hasSettingsChanged) {
      requestData.settings = settings;
    }
    
    regenerateMutation.mutate(requestData);
  };

  const handleClose = () => {
    if (!regenerateMutation.isPending) {
      onOpenChange(false);
      setInstruction('');
      setHasSettingsChanged(false);
      setUseOriginalAsReference(true);
      setSettings(generationSettingsSchema.parse({
        model: 'gpt-image-1',
        quality: 'standard',
        size: '1024x1024',
        variations: 1,
        transparency: false
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Regenerate Image
          </DialogTitle>
          <DialogDescription>
            Create a new variation by editing the original image or generating fresh using the same concept
          </DialogDescription>
        </DialogHeader>

        {image && (
          <div className="space-y-4">
            {/* Original Image Preview */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <img
                  src={image.imageUrl}
                  alt={image.visualConcept}
                  className="w-24 h-24 object-cover rounded-lg border"
                />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-sm font-medium">Original Concept</Label>
                  <p className="text-sm text-muted-foreground">{image.visualConcept}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    Generated Image
                  </Badge>
                  {image.createdAt && (
                    <Badge variant="outline" className="text-xs">
                      {new Date(image.createdAt).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Use Original as Reference Checkbox */}
            <div className="flex items-center space-x-2 p-3 border rounded-lg">
              <Checkbox
                id="use-original-reference"
                checked={useOriginalAsReference}
                onCheckedChange={(checked) => setUseOriginalAsReference(checked as boolean)}
                data-testid="checkbox-use-original-reference"
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="use-original-reference"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Use original image as reference
                </Label>
                <p className="text-xs text-muted-foreground">
                  {useOriginalAsReference 
                    ? "Will modify the original image with your instructions and settings"
                    : "Will create a completely new image using the same prompt with your settings"
                  }
                </p>
              </div>
            </div>

            {/* Generation Settings */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Generation Settings</Label>
              <GenerationSettingsComponent
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
              <p className="text-xs text-muted-foreground">
                Adjust settings to enhance image quality or change parameters
              </p>
            </div>

            {/* Modification Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instruction" className="text-sm font-medium">
                {useOriginalAsReference ? "Modification Instructions" : "Additional Instructions"}
                <span className="text-xs text-muted-foreground ml-2">(Optional if changing settings)</span>
              </Label>
              <Textarea
                id="instruction"
                placeholder={useOriginalAsReference 
                  ? "Describe how you want to modify this image (e.g., 'make it more colorful', 'add a sunset background', 'change to a different art style')"
                  : "Provide additional instructions to refine the original concept (e.g., 'make it more vibrant', 'different lighting', 'different composition')"
                }
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="min-h-[100px] resize-none"
                data-testid="textarea-regeneration-instruction"
              />
              <p className="text-xs text-muted-foreground">
                {useOriginalAsReference 
                  ? "Leave blank to enhance with current settings only, or provide specific modification instructions"
                  : "Leave blank to regenerate the original concept with new settings, or provide additional refinements"
                }
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={regenerateMutation.isPending}
            data-testid="button-cancel-regeneration"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={(!instruction.trim() && !hasSettingsChanged) || regenerateMutation.isPending}
            data-testid="button-confirm-regeneration"
          >
            {regenerateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}