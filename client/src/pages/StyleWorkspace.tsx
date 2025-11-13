import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Save, 
  RefreshCw, 
  Sparkles, 
  Send,
  Image as ImageIcon,
  Settings,
  Layers,
  Info,
  ChevronLeft,
  ChevronRight,
  Undo
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageStyle } from '@shared/schema';
import type { MediaAdapter } from '@/lib/api';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { conceptToDisplayString } from '@shared/utils';

interface StyleWorkspaceProps {
  styleId?: string;
}

export default function StyleWorkspace() {
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Extract styleId from URL parameters using window.location for full URL
  const fullUrl = window.location.search;
  const urlParams = new URLSearchParams(fullUrl);
  const styleId = urlParams.get('id');
  
  
  // State for style data
  const [styleName, setStyleName] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [compositionPrompt, setCompositionPrompt] = useState('');
  const [conceptPrompt, setConceptPrompt] = useState('');
  const [styleFramework, setStyleFramework] = useState<Record<string, any> | null>(null);
  const [compositionFramework, setCompositionFramework] = useState<Record<string, any> | null>(null);
  const [conceptFramework, setConceptFramework] = useState<Record<string, any> | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [generatedConcept, setGeneratedConcept] = useState('');
  const [testConcepts, setTestConcepts] = useState<any[]>([]);
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0);
  
  // Refinement feedback state (per tab)
  const [styleFeedback, setStyleFeedback] = useState('');
  const [compositionFeedback, setCompositionFeedback] = useState('');
  const [conceptFeedback, setConceptFeedback] = useState('');
  
  // Version control history for undo functionality
  const [styleHistory, setStyleHistory] = useState<Array<{ prompt: string; framework: Record<string, any> | null }>>([]);
  const [compositionHistory, setCompositionHistory] = useState<Array<{ prompt: string; framework: Record<string, any> | null }>>([]);
  const [conceptHistory, setConceptHistory] = useState<Array<{ prompt: string; framework: Record<string, any> | null; testConcepts: any[] }>>([]);
  
  // Track concept refinement version to prevent race conditions with regeneration
  const conceptRefinementVersionRef = useRef(0);
  
  // Generation settings state
  const [generationSettings, setGenerationSettings] = useState({
    model: 'gpt-image-1',
    quality: 'standard',
    size: '1024x1024',
    transparency: false
  });

  // Fetch style data
  const { data: style, isLoading } = useQuery({
    queryKey: ['imageStyle', styleId],
    queryFn: () => api.getImageStyle(styleId!),
    enabled: !!styleId
  });

  // Fetch media adapter if style has one
  const { data: mediaAdapter } = useQuery<MediaAdapter>({
    queryKey: ['/api/media-adapters', style?.mediaAdapterId],
    queryFn: ({ queryKey }) => {
      const [, adapterId] = queryKey;
      if (!adapterId) throw new Error('Media adapter ID is required');
      return api.getMediaAdapter(adapterId as string);
    },
    enabled: !!style?.mediaAdapterId,
  });

  // Initialize form data when style loads
  useEffect(() => {
    if (style) {
      setStyleName(style.name);
      setStylePrompt(style.stylePrompt || '');
      setCompositionPrompt(style.compositionPrompt || '');
      setConceptPrompt(style.conceptPrompt || '');
      setStyleFramework(style.styleFramework || null);
      setCompositionFramework(style.compositionFramework || null);
      setConceptFramework(style.conceptFramework || null);
      setPreviewImageUrl(style.previewImageUrl || '');
      setReferenceImageUrl(style.referenceImageUrl || '');
      setTestConcepts(style.testConcepts || []);
      setCurrentConceptIndex(0);
      setGeneratedConcept('A creative concept for preview'); // Default concept
    }
  }, [style]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!styleId) throw new Error('No style ID provided');
      
      const updateData = {
        name: styleName,
        stylePrompt,
        compositionPrompt,
        conceptPrompt,
        styleFramework: styleFramework || undefined,
        compositionFramework: compositionFramework || undefined,
        conceptFramework: conceptFramework || undefined,
        previewImageUrl,
        referenceImageUrl,
        testConcepts: testConcepts.length > 0 ? testConcepts : undefined,
      };
      
      return api.updateImageStyle(styleId, updateData);
    },
    onSuccess: (data) => {
      // Invalidate the style query cache to ensure fresh data is fetched
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['imageStyle', data.id] });
      }
      if (styleId) {
        queryClient.invalidateQueries({ queryKey: ['imageStyle', styleId] });
      }
      queryClient.invalidateQueries({ queryKey: ['imageStyles'] });
    },
  });

  // Regenerate test concepts mutation
  const regenerateConceptsMutation = useMutation({
    mutationFn: async (params?: { conceptPrompt?: string; conceptFramework?: Record<string, any> | null; expectedVersion?: number }) => {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/regenerate-test-concepts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conceptPrompt: params?.conceptPrompt ?? conceptPrompt,
          conceptFramework: params?.conceptFramework ?? conceptFramework,
        }),
      });
      if (!response.ok) throw new Error('Failed to regenerate test concepts');
      const result = await response.json();
      return { ...result, expectedVersion: params?.expectedVersion };
    },
    onSuccess: (data) => {
      // Only apply if version matches (no undo happened while regenerating)
      if (data.expectedVersion !== undefined && data.expectedVersion !== conceptRefinementVersionRef.current) {
        console.log('Ignoring stale regeneration result (version mismatch)');
        return;
      }
      
      setTestConcepts(data.testConcepts || []);
      setCurrentConceptIndex(0);
      toast({
        title: 'Test concepts regenerated',
        description: 'Successfully generated new test concepts',
      });
    },
    onError: () => {
      toast({
        title: 'Regeneration failed',
        description: 'Failed to regenerate test concepts',
        variant: 'destructive',
      });
    },
  });

  // Prompt refinement mutation
  const refineMutation = useMutation({
    mutationFn: async ({ promptType, feedback }: { promptType: 'style' | 'composition' | 'concept', feedback: string }) => {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/refine-style', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          promptType,
          currentPrompt: promptType === 'style' ? stylePrompt : promptType === 'composition' ? compositionPrompt : conceptPrompt,
          currentFramework: promptType === 'style' ? styleFramework : promptType === 'composition' ? compositionFramework : conceptFramework,
          feedback,
        }),
      });
      if (!response.ok) throw new Error('Prompt refinement failed');
      return response.json();
    },
  });

  // Preview generation mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/generate-style-preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stylePrompt,
          compositionPrompt,
          conceptPrompt,
          concept: generatedConcept,
          model: generationSettings.model,
          quality: generationSettings.quality,
          size: generationSettings.size,
          transparency: generationSettings.transparency,
        }),
      });
      if (!response.ok) throw new Error('Preview generation failed');
      return response.json();
    },
  });

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync();
      // Clear all history when saving (session-based undo)
      setStyleHistory([]);
      setCompositionHistory([]);
      setConceptHistory([]);
      toast({
        title: 'Style Saved',
        description: 'Your style has been successfully updated.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save the style. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleRefinePrompt = async (promptType: 'style' | 'composition' | 'concept') => {
    const feedback = promptType === 'style' ? styleFeedback : promptType === 'composition' ? compositionFeedback : conceptFeedback;
    
    if (!feedback.trim()) {
      toast({
        title: 'Feedback Required',
        description: 'Please enter feedback to refine the prompt.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Save current state to history before making changes
      if (promptType === 'style') {
        setStyleHistory(prev => [...prev, { prompt: stylePrompt, framework: styleFramework }]);
      } else if (promptType === 'composition') {
        setCompositionHistory(prev => [...prev, { prompt: compositionPrompt, framework: compositionFramework }]);
      } else if (promptType === 'concept') {
        setConceptHistory(prev => [...prev, { prompt: conceptPrompt, framework: conceptFramework, testConcepts }]);
      }

      const result = await refineMutation.mutateAsync({ promptType, feedback });
      
      // Update the appropriate prompt and framework
      if (promptType === 'style') {
        if (result.refinedPrompt) setStylePrompt(result.refinedPrompt);
        if (result.refinedFramework) setStyleFramework(result.refinedFramework);
        setStyleFeedback('');
      } else if (promptType === 'composition') {
        if (result.refinedPrompt) setCompositionPrompt(result.refinedPrompt);
        if (result.refinedFramework) setCompositionFramework(result.refinedFramework);
        setCompositionFeedback('');
      } else if (promptType === 'concept') {
        if (result.refinedPrompt) setConceptPrompt(result.refinedPrompt);
        if (result.refinedFramework) setConceptFramework(result.refinedFramework);
        setConceptFeedback('');
        
        // Increment version to mark this refinement
        conceptRefinementVersionRef.current += 1;
        const expectedVersion = conceptRefinementVersionRef.current;
        
        // Show initial success for prompt refinement
        toast({
          title: 'Prompt Refined',
          description: 'The concept prompt has been successfully refined.'
        });
        
        // Automatically regenerate test concepts with the new concept prompt and framework
        try {
          await regenerateConceptsMutation.mutateAsync({
            conceptPrompt: result.refinedPrompt || conceptPrompt,
            conceptFramework: result.refinedFramework || conceptFramework,
            expectedVersion: expectedVersion
          });
          // Mutation's onSuccess already handles updating state and showing success toast
          // Version checking happens in onSuccess to prevent stale updates
        } catch (regenerateError) {
          console.error('Failed to regenerate test concepts:', regenerateError);
          toast({
            title: 'Warning',
            description: 'Test concepts regeneration failed. You can manually regenerate them using the button below.',
            variant: 'default'
          });
        }
        return; // Early return to avoid duplicate toast
      }
      
      toast({
        title: 'Prompt Refined',
        description: `The ${promptType} prompt has been successfully refined.`
      });
    } catch (error) {
      // Rollback history on failure
      if (promptType === 'style') {
        setStyleHistory(prev => prev.slice(0, -1));
      } else if (promptType === 'composition') {
        setCompositionHistory(prev => prev.slice(0, -1));
      } else if (promptType === 'concept') {
        setConceptHistory(prev => prev.slice(0, -1));
      }
      
      toast({
        title: 'Refinement Failed',
        description: 'Failed to refine the prompt. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleUndo = (promptType: 'style' | 'composition' | 'concept') => {
    if (promptType === 'style' && styleHistory.length > 0) {
      const previousState = styleHistory[styleHistory.length - 1];
      setStylePrompt(previousState.prompt);
      setStyleFramework(previousState.framework);
      setStyleHistory(prev => prev.slice(0, -1));
      toast({
        title: 'Undo Successful',
        description: 'Reverted to previous style prompt version.'
      });
    } else if (promptType === 'composition' && compositionHistory.length > 0) {
      const previousState = compositionHistory[compositionHistory.length - 1];
      setCompositionPrompt(previousState.prompt);
      setCompositionFramework(previousState.framework);
      setCompositionHistory(prev => prev.slice(0, -1));
      toast({
        title: 'Undo Successful',
        description: 'Reverted to previous composition prompt version.'
      });
    } else if (promptType === 'concept' && conceptHistory.length > 0) {
      const previousState = conceptHistory[conceptHistory.length - 1];
      setConceptPrompt(previousState.prompt);
      setConceptFramework(previousState.framework);
      setTestConcepts(previousState.testConcepts);
      setCurrentConceptIndex(0); // Reset index to prevent out-of-bounds access
      setConceptHistory(prev => prev.slice(0, -1));
      
      // Increment version to invalidate any in-flight regeneration
      conceptRefinementVersionRef.current += 1;
      
      toast({
        title: 'Undo Successful',
        description: 'Reverted to previous concept prompt version and test concepts.'
      });
    }
  };

  const handleGeneratePreview = async () => {
    if (!generatedConcept.trim()) {
      toast({
        title: 'Concept Required',
        description: 'Please enter a concept to generate a preview.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = await previewMutation.mutateAsync();
      setPreviewImageUrl(result.imageUrl);
      
      toast({
        title: 'Preview Generated',
        description: 'Style preview has been generated successfully.'
      });
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: 'Failed to generate preview. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const updateGenerationSetting = (key: string, value: any) => {
    setGenerationSettings(prev => {
      const updated = {
        ...prev,
        [key]: value
      };
      
      // Auto-switch to gpt-image-1 when transparency is enabled (only model that supports it)
      if (key === 'transparency' && value === true) {
        updated.model = 'gpt-image-1';
      }
      
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading style...</p>
        </div>
      </div>
    );
  }

  if (!style) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Style not found</h3>
          <Link href="/styles">
            <Button>Back to Styles</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/styles">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{styleName}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Extracted
                </Badge>
                {mediaAdapter && (
                  <Badge variant="outline" className="text-xs gap-1" data-testid="badge-media-adapter">
                    <Layers className="w-3 h-3" />
                    {mediaAdapter.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2"
              data-testid="button-save"
            >
              {saveMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save style
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Reference Image & Media Adapter */}
        <div className="w-64 border-r bg-muted/5 p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Reference
            </h3>
            {referenceImageUrl ? (
              <div className="aspect-video rounded-md overflow-hidden bg-muted border">
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="w-full h-full object-cover"
                  data-testid="img-reference"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground aspect-video border rounded-md bg-muted">
                <ImageIcon className="w-4 h-4" />
                <p className="text-sm">No reference</p>
              </div>
            )}
          </div>

          {mediaAdapter && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Media Type
              </h3>
              <Card>
                <CardHeader className="p-3 space-y-1">
                  <CardTitle className="text-sm">{mediaAdapter.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{mediaAdapter.description}</p>
                </CardHeader>
              </Card>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border text-xs">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">
                  This adapter was used during style extraction to apply media-specific adjustments.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Center - Tabbed Prompts */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Style name</Label>
              <Input
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                data-testid="input-style-name"
              />
            </div>

            <Tabs defaultValue="style" className="w-full" data-testid="tabs-prompts">
              <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
                <TabsTrigger value="style" data-testid="tab-trigger-style">Style</TabsTrigger>
                <TabsTrigger value="composition" data-testid="tab-trigger-composition">Composition</TabsTrigger>
                <TabsTrigger value="concept" data-testid="tab-trigger-concept">Concept</TabsTrigger>
              </TabsList>

              <TabsContent value="style" className="space-y-4" data-testid="tab-content-style">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current style definition</Label>
                  {styleFramework ? (
                    <div className="bg-muted rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto" data-testid="style-structured-view">
                      <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(styleFramework, null, 2)}</pre>
                    </div>
                  ) : (
                    <Textarea
                      value={stylePrompt}
                      readOnly
                      rows={10}
                      className="resize-none bg-muted"
                      data-testid="textarea-style-prompt"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Refinement feedback</Label>
                  <Textarea
                    value={styleFeedback}
                    onChange={(e) => setStyleFeedback(e.target.value)}
                    placeholder="Describe how to refine this style prompt..."
                    rows={4}
                    className="resize-none"
                    data-testid="textarea-style-feedback"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleRefinePrompt('style')}
                    disabled={refineMutation.isPending || !styleFeedback.trim()}
                    className="gap-2 flex-1"
                    data-testid="button-refine-style"
                  >
                    {refineMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Refining...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Refine style prompt
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleUndo('style')}
                    disabled={styleHistory.length === 0}
                    className="gap-2"
                    data-testid="button-undo-style"
                  >
                    <Undo className="w-4 h-4" />
                    Undo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="composition" className="space-y-4" data-testid="tab-content-composition">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current composition prompt</Label>
                  {compositionFramework ? (
                    <div className="bg-muted rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto" data-testid="composition-structured-view">
                      <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(compositionFramework, null, 2)}</pre>
                    </div>
                  ) : (
                    <Textarea
                      value={compositionPrompt}
                      readOnly
                      rows={10}
                      className="resize-none bg-muted"
                      data-testid="textarea-composition-prompt"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Refinement feedback</Label>
                  <Textarea
                    value={compositionFeedback}
                    onChange={(e) => setCompositionFeedback(e.target.value)}
                    placeholder="Describe how to refine this composition prompt..."
                    rows={4}
                    className="resize-none"
                    data-testid="textarea-composition-feedback"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleRefinePrompt('composition')}
                    disabled={refineMutation.isPending || !compositionFeedback.trim()}
                    className="gap-2 flex-1"
                    data-testid="button-refine-composition"
                  >
                    {refineMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Refining...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Refine composition prompt
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUndo('composition')}
                  disabled={compositionHistory.length === 0}
                  className="gap-2"
                  data-testid="button-undo-composition"
                >
                  <Undo className="w-4 h-4" />
                  Undo
                </Button>
              </div>
              </TabsContent>

              <TabsContent value="concept" className="space-y-4" data-testid="tab-content-concept">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current concept prompt</Label>
                  {conceptFramework ? (
                    <div className="bg-muted rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto" data-testid="concept-structured-view">
                      <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(conceptFramework, null, 2)}</pre>
                    </div>
                  ) : (
                    <Textarea
                      value={conceptPrompt}
                      readOnly
                      rows={10}
                      className="resize-none bg-muted"
                      data-testid="textarea-concept-prompt"
                    />
                  )}
                </div>

                {testConcepts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Test Concepts</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          conceptRefinementVersionRef.current += 1;
                          regenerateConceptsMutation.mutate({ expectedVersion: conceptRefinementVersionRef.current });
                        }}
                        disabled={regenerateConceptsMutation.isPending}
                        className="gap-2"
                        data-testid="button-regenerate-concepts"
                      >
                        {regenerateConceptsMutation.isPending ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentConceptIndex((prev) => Math.max(0, prev - 1))}
                        disabled={currentConceptIndex === 0}
                        data-testid="button-prev-concept"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex-1 p-3 bg-muted rounded-md min-h-[60px] flex items-center">
                        <p className="text-sm" data-testid="text-test-concept">
                          {conceptToDisplayString(testConcepts[currentConceptIndex])}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentConceptIndex((prev) => Math.min(testConcepts.length - 1, prev + 1))}
                        disabled={currentConceptIndex === testConcepts.length - 1}
                        data-testid="button-next-concept"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Concept {currentConceptIndex + 1} of {testConcepts.length}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Refinement feedback</Label>
                  <Textarea
                    value={conceptFeedback}
                    onChange={(e) => setConceptFeedback(e.target.value)}
                    placeholder="Describe how to refine this concept prompt..."
                    rows={4}
                    className="resize-none"
                    data-testid="textarea-concept-feedback"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleRefinePrompt('concept')}
                    disabled={refineMutation.isPending || !conceptFeedback.trim()}
                    className="gap-2 flex-1"
                    data-testid="button-refine-concept"
                  >
                    {refineMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Refining...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Refine concept prompt
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleUndo('concept')}
                    disabled={conceptHistory.length === 0}
                    className="gap-2"
                    data-testid="button-undo-concept"
                  >
                    <Undo className="w-4 h-4" />
                    Undo
                  </Button>
                </div>
                <div className="w-full">
                  <Button
                    onClick={handleGeneratePreview}
                    disabled={previewMutation.isPending}
                    variant="outline"
                    className="gap-2"
                    data-testid="button-generate-preview"
                  >
                    {previewMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate preview
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right sidebar - Preview */}
        <div className="w-80 border-l bg-muted/5 p-4">
          <div className="space-y-4">
            <h3 className="font-medium">Style preview</h3>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Test concept</Label>
              <Textarea
                value={generatedConcept}
                onChange={(e) => setGeneratedConcept(e.target.value)}
                placeholder="Enter a concept to test..."
                rows={3}
                className="resize-none"
                data-testid="textarea-test-concept"
              />
            </div>

            {previewImageUrl ? (
              <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                <img
                  src={previewImageUrl}
                  alt="Style preview"
                  className="w-full h-full object-cover"
                  data-testid="img-preview"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center aspect-square rounded-lg border bg-muted text-muted-foreground">
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No preview</p>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="w-4 h-4" />
                <span>Generation settings</span>
              </div>
              
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <Select
                    value={generationSettings.model}
                    onValueChange={(value) => updateGenerationSetting('model', value)}
                  >
                    <SelectTrigger className="h-8" data-testid="select-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                      <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                      <SelectItem value="gpt-image-1">GPT Image 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Size</Label>
                  <Select
                    value={generationSettings.size}
                    onValueChange={(value) => updateGenerationSetting('size', value)}
                  >
                    <SelectTrigger className="h-8" data-testid="select-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024x1024">Square</SelectItem>
                      <SelectItem value="1024x1536">Portrait</SelectItem>
                      <SelectItem value="1536x1024">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}