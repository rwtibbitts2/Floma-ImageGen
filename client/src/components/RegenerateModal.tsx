import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { GeneratedImage } from '@shared/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface RegenerateModalProps {
  image: GeneratedImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

interface RegenerateRequest {
  sourceImageId: string;
  regenerationInstruction: string;
  sessionId: string;
}

export default function RegenerateModal({ image, open, onOpenChange, sessionId }: RegenerateModalProps) {
  const [instruction, setInstruction] = useState('');
  const queryClient = useQueryClient();

  const regenerateMutation = useMutation({
    mutationFn: async (data: RegenerateRequest) => {
      return apiRequest('/api/regenerate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'images'] });
      onOpenChange(false);
      setInstruction('');
    },
  });

  const handleRegenerate = () => {
    if (!image || !instruction.trim()) return;
    
    regenerateMutation.mutate({
      sourceImageId: image.id,
      regenerationInstruction: instruction.trim(),
      sessionId,
    });
  };

  const handleClose = () => {
    if (!regenerateMutation.isPending) {
      onOpenChange(false);
      setInstruction('');
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
            Create a new variation of this image with your modifications
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
                  {image.styleName && (
                    <Badge variant="outline" className="text-xs">
                      Style: {image.styleName}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {image.generationSettings?.size || 'Default Size'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Quality: {image.generationSettings?.quality || 'Standard'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Modification Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instruction" className="text-sm font-medium">
                Modification Instructions
              </Label>
              <Textarea
                id="instruction"
                placeholder="Describe how you want to modify this image (e.g., 'make it more colorful', 'add a sunset background', 'change to a different art style')"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="min-h-[100px] resize-none"
                data-testid="textarea-regeneration-instruction"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about the changes you want to see in the regenerated version
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
            disabled={!instruction.trim() || regenerateMutation.isPending}
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