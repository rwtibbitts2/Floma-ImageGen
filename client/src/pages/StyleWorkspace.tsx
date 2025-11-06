import { useState, useEffect } from 'react';
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
  Settings
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageStyle } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

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
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [generatedConcept, setGeneratedConcept] = useState('');
  
  // Refinement feedback state (per tab)
  const [styleFeedback, setStyleFeedback] = useState('');
  const [compositionFeedback, setCompositionFeedback] = useState('');
  const [conceptFeedback, setConceptFeedback] = useState('');
  
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

  // Initialize form data when style loads
  useEffect(() => {
    if (style) {
      setStyleName(style.name);
      setStylePrompt(style.stylePrompt || '');
      setCompositionPrompt(style.compositionPrompt || '');
      setConceptPrompt(style.conceptPrompt || '');
      setPreviewImageUrl(style.previewImageUrl || '');
      setReferenceImageUrl(style.referenceImageUrl || '');
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
        previewImageUrl,
        referenceImageUrl,
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
      const result = await refineMutation.mutateAsync({ promptType, feedback });
      
      // Update the appropriate prompt
      if (promptType === 'style' && result.refinedPrompt) {
        setStylePrompt(result.refinedPrompt);
        setStyleFeedback('');
      } else if (promptType === 'composition' && result.refinedPrompt) {
        setCompositionPrompt(result.refinedPrompt);
        setCompositionFeedback('');
      } else if (promptType === 'concept' && result.refinedPrompt) {
        setConceptPrompt(result.refinedPrompt);
        setConceptFeedback('');
      }
      
      toast({
        title: 'Prompt Refined',
        description: `The ${promptType} prompt has been successfully refined.`
      });
    } catch (error) {
      toast({
        title: 'Refinement Failed',
        description: 'Failed to refine the prompt. Please try again.',
        variant: 'destructive'
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
        {/* Left sidebar - Reference Image */}
        <div className="w-64 border-r bg-muted/5 p-4">
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
                  {(() => {
                    try {
                      const styleData = JSON.parse(stylePrompt);
                      return (
                        <div className="bg-muted rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto" data-testid="style-structured-view">
                          {styleData.style_name && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Style Name</div>
                              <div className="text-sm">{styleData.style_name}</div>
                            </div>
                          )}
                          {styleData.style_summary && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Summary</div>
                              <div className="text-sm">{styleData.style_summary}</div>
                            </div>
                          )}
                          {styleData.camera && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Camera</div>
                              <div className="text-sm space-y-1 pl-3 border-l-2 border-border">
                                {Object.entries(styleData.camera).map(([key, value]) => (
                                  <div key={key}><span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(value)}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {styleData.lighting && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Lighting</div>
                              <div className="text-sm space-y-1 pl-3 border-l-2 border-border">
                                {Object.entries(styleData.lighting).map(([key, value]) => (
                                  <div key={key}><span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(value)}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {styleData.surface_behavior && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Surface Behavior</div>
                              <div className="text-sm space-y-1 pl-3 border-l-2 border-border">
                                {Object.entries(styleData.surface_behavior).map(([key, value]) => (
                                  <div key={key}><span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(value)}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {styleData.color_treatment && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Color Treatment</div>
                              <div className="text-sm space-y-1 pl-3 border-l-2 border-border">
                                {Object.entries(styleData.color_treatment).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                                    {key === 'palette' && Array.isArray(value) ? (
                                      <div className="flex gap-1 mt-1">
                                        {value.map((color, i) => (
                                          <div key={i} className="flex items-center gap-1">
                                            <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: color }}></div>
                                            <span className="text-xs text-muted-foreground">{color}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : String(value)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {styleData.finishing_treatment && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Finishing Treatment</div>
                              <div className="text-sm space-y-1 pl-3 border-l-2 border-border">
                                {Object.entries(styleData.finishing_treatment).map(([key, value]) => (
                                  <div key={key}><span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(value)}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {styleData.mood && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Mood</div>
                              <div className="text-sm">{styleData.mood}</div>
                            </div>
                          )}
                          {styleData.media_type_alignment && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Media Type</div>
                              <div className="text-sm">{styleData.media_type_alignment}</div>
                            </div>
                          )}
                          {styleData.complexity_level && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Complexity</div>
                              <div className="text-sm">{styleData.complexity_level}</div>
                            </div>
                          )}
                        </div>
                      );
                    } catch {
                      // Fall back to raw text if not valid JSON
                      return (
                        <Textarea
                          value={stylePrompt}
                          readOnly
                          rows={10}
                          className="resize-none bg-muted"
                          data-testid="textarea-style-prompt"
                        />
                      );
                    }
                  })()}
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
                <Button
                  onClick={() => handleRefinePrompt('style')}
                  disabled={refineMutation.isPending || !styleFeedback.trim()}
                  className="gap-2"
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
              </TabsContent>

              <TabsContent value="composition" className="space-y-4" data-testid="tab-content-composition">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current composition prompt</Label>
                  <Textarea
                    value={compositionPrompt}
                    readOnly
                    rows={10}
                    className="resize-none bg-muted"
                    data-testid="textarea-composition-prompt"
                  />
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
                <Button
                  onClick={() => handleRefinePrompt('composition')}
                  disabled={refineMutation.isPending || !compositionFeedback.trim()}
                  className="gap-2"
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
              </TabsContent>

              <TabsContent value="concept" className="space-y-4" data-testid="tab-content-concept">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current concept prompt</Label>
                  <Textarea
                    value={conceptPrompt}
                    readOnly
                    rows={10}
                    className="resize-none bg-muted"
                    data-testid="textarea-concept-prompt"
                  />
                </div>
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
                    className="gap-2"
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