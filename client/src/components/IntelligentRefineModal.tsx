import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IntelligentRefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (refinements: RefinementResult) => void;
  referenceImageUrl: string;
  previewImageUrl: string;
  stylePrompt: string;
  styleFramework: Record<string, any> | null;
  compositionPrompt: string;
  compositionFramework: Record<string, any> | null;
  conceptPrompt: string;
  conceptFramework: Record<string, any> | null;
  testConcepts: any[];
}

interface TestConceptFeedback {
  index: number;
  summary: string;
  alignmentScore: number;
  requiredFixes: string;
  status: 'valid' | 'invalid';
}

interface RefinementResult {
  explanation: string;
  refinedStylePrompt: string;
  refinedStyleFramework: Record<string, any> | null;
  refinedCompositionPrompt: string;
  refinedCompositionFramework: Record<string, any> | null;
  refinedConceptPrompt: string;
  refinedConceptFramework: Record<string, any> | null;
  testConceptFeedback: TestConceptFeedback[];
  overallConceptGuidance: string | null;
}

export default function IntelligentRefineModal({
  isOpen,
  onClose,
  onAccept,
  referenceImageUrl,
  previewImageUrl,
  stylePrompt,
  styleFramework,
  compositionPrompt,
  compositionFramework,
  conceptPrompt,
  conceptFramework,
  testConcepts,
}: IntelligentRefineModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinementResult, setRefinementResult] = useState<RefinementResult | null>(null);

  // Trigger analysis when modal opens
  useEffect(() => {
    if (isOpen && !refinementResult && !isAnalyzing) {
      performIntelligentRefine();
    }
  }, [isOpen]);

  const performIntelligentRefine = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/intelligent-refine', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          referenceImageUrl,
          previewImageUrl,
          stylePrompt,
          styleFramework,
          compositionPrompt,
          compositionFramework,
          conceptPrompt,
          conceptFramework,
          testConcepts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform intelligent refinement');
      }

      const result = await response.json();
      setRefinementResult(result);
    } catch (err) {
      console.error('Intelligent refine error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAccept = () => {
    if (!refinementResult) {
      return;
    }

    // Validate that we have all required fields before accepting
    if (!refinementResult.explanation) {
      setError('Invalid refinement result: missing explanation');
      return;
    }

    // Call the parent's onAccept handler with validated result
    onAccept(refinementResult);
    handleClose();
  };

  const handleClose = () => {
    setRefinementResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Intelligent Refine
          </DialogTitle>
          <DialogDescription>
            AI-powered analysis comparing your reference image with the generated preview
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Analyzing images...</p>
                  <p className="text-sm text-muted-foreground">
                    GPT-5 is comparing the reference and preview images
                  </p>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {refinementResult && (
              <div className="space-y-4">
                {/* Explanation */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Analysis</h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm">{refinementResult.explanation}</p>
                  </div>
                </div>

                <Separator />

                {/* Refined prompts preview */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Suggested Refinements</h4>
                  
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Style Prompt</div>
                    <div className="p-3 rounded-md bg-muted/30 border text-sm">
                      {refinementResult.refinedStylePrompt.substring(0, 200)}
                      {refinementResult.refinedStylePrompt.length > 200 && '...'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Composition Prompt</div>
                    <div className="p-3 rounded-md bg-muted/30 border text-sm">
                      {refinementResult.refinedCompositionPrompt.substring(0, 200)}
                      {refinementResult.refinedCompositionPrompt.length > 200 && '...'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Concept Prompt</div>
                    <div className="p-3 rounded-md bg-muted/30 border text-sm">
                      {refinementResult.refinedConceptPrompt.substring(0, 200)}
                      {refinementResult.refinedConceptPrompt.length > 200 && '...'}
                    </div>
                  </div>
                </div>

                {/* Test Concept Feedback */}
                {refinementResult.testConceptFeedback && refinementResult.testConceptFeedback.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Test Concept Evaluation</h4>
                      
                      <div className="space-y-2">
                        {refinementResult.testConceptFeedback.map((feedback) => (
                          <div 
                            key={feedback.index} 
                            className="p-3 rounded-md border bg-card space-y-1"
                            data-testid={`test-concept-feedback-${feedback.index}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">Concept {feedback.index + 1}</span>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={feedback.status === 'valid' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {feedback.status}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  Score: {feedback.alignmentScore}/10
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{feedback.summary}</p>
                            {feedback.requiredFixes && feedback.requiredFixes !== 'none' && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Fixes needed:</span> {feedback.requiredFixes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {refinementResult.overallConceptGuidance && (
                        <div className="p-4 rounded-lg bg-muted/50 border">
                          <p className="text-xs font-medium mb-2">Overall Guidance</p>
                          <p className="text-sm">{refinementResult.overallConceptGuidance}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-refine"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!refinementResult || isAnalyzing}
            data-testid="button-accept-refine"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Accept Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
