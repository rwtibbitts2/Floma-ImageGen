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
import { 
  ArrowLeft, 
  Save, 
  RefreshCw, 
  Sparkles, 
  MessageSquare,
  Send,
  Image as ImageIcon,
  Settings,
  Undo
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ImageStyle } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { buildStyleDescription } from '@shared/utils';

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
  const [styleData, setStyleData] = useState<any>(null);
  const [previousStyleData, setPreviousStyleData] = useState<any>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [generatedConcept, setGeneratedConcept] = useState('');
  const [renderText, setRenderText] = useState(true);
  
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
      setStyleData(style.aiStyleData || {});
      setPreviewImageUrl(style.previewImageUrl || '');
      setReferenceImageUrl(style.referenceImageUrl || '');
      // Set renderText from saved style data (default to true if not set)
      setRenderText((style.aiStyleData as any)?.renderText !== undefined ? (style.aiStyleData as any).renderText : true);
      // Set generated concept from AI extraction, or create one from style data
      if (style.generatedConcept) {
        setGeneratedConcept(style.generatedConcept);
      } else if (style.aiStyleData && (style.aiStyleData as any)?.description) {
        // Fallback: create a simple concept from the style description
        setGeneratedConcept(((style.aiStyleData as any).description as string).split('.')[0] || 'Creative concept');
      }
    }
  }, [style]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!styleId) throw new Error('No style ID provided');
      
      const updateData = {
        name: styleName,
        stylePrompt: styleData ? buildStyleDescription(styleData) : 'AI-extracted style',
        aiStyleData: { ...styleData, renderText },
        previewImageUrl,
        referenceImageUrl,
        generatedConcept,
      };
      
      return api.updateImageStyle(styleId, updateData);
    },
    onSuccess: (data) => {
      // Invalidate the style query cache to ensure fresh data is fetched
      // Use the returned data's ID to ensure we invalidate the correct cache entry
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['imageStyle', data.id] });
      }
      // Also invalidate by the current styleId to be safe
      if (styleId) {
        queryClient.invalidateQueries({ queryKey: ['imageStyle', styleId] });
      }
      // Invalidate the list of all styles
      queryClient.invalidateQueries({ queryKey: ['imageStyles'] });
    },
  });

  // Style refinement mutation
  const refineMutation = useMutation({
    mutationFn: async (feedback: string) => {
      // Get JWT token for authentication
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
          styleData: styleData || {},
          feedback: feedback,
        }),
      });
      if (!response.ok) throw new Error('Style refinement failed');
      return response.json();
    },
  });

  // Preview generation mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      // Get JWT token for authentication
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
          styleData: styleData || {},
          concept: generatedConcept,
          model: generationSettings.model,
          quality: generationSettings.quality,
          size: generationSettings.size,
          transparency: generationSettings.transparency,
          renderText: renderText,
        }),
      });
      if (!response.ok) throw new Error('Preview generation failed');
      return response.json();
    },
  });

  // New concept generation mutation
  const newConceptMutation = useMutation({
    mutationFn: async () => {
      // Get JWT token for authentication
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/generate-new-concept', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          styleId: styleId,
        }),
      });
      if (!response.ok) throw new Error('Concept generation failed');
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

  const handleRefineStyle = async () => {
    if (!chatMessage.trim()) {
      toast({
        title: 'Feedback Required',
        description: 'Please enter feedback to refine the style definition.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Save current state before refining
      setPreviousStyleData(styleData);
      
      const result = await refineMutation.mutateAsync(chatMessage);
      setStyleData(result.refinedStyleData);
      
      setChatMessage('');
      toast({
        title: 'Style Refined',
        description: 'Your style definition has been successfully refined with your feedback.'
      });
    } catch (error) {
      toast({
        title: 'Refinement Failed',
        description: 'Failed to refine the style definition. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleUndo = () => {
    if (previousStyleData) {
      setStyleData(previousStyleData);
      setPreviousStyleData(null);
      toast({
        title: 'Changes Reverted',
        description: 'Style has been restored to the previous state.'
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

  const handleGenerateNewConcept = async () => {
    try {
      const result = await newConceptMutation.mutateAsync();
      setGeneratedConcept(result.concept);
      
      toast({
        title: 'New Concept Generated',
        description: 'A new random concept has been generated using the same prompt.'
      });
    } catch (error) {
      toast({
        title: 'Concept Generation Failed',
        description: 'Failed to generate new concept. Please try again.',
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

  const updateStyleField = (field: string, value: any, nestedField?: string) => {
    setStyleData((prev: any) => {
      const updated = { ...(prev || {}) };
      if (nestedField) {
        updated[field] = { ...(updated[field] || {}), [nestedField]: value };
      } else {
        updated[field] = value;
      }
      return updated;
    });
  };

  const addColor = () => {
    const newColor = '#000000';
    const paletteField = styleData?.color_palette ? 'color_palette' : 'palette';
    const currentPalette = styleData?.color_palette || styleData?.palette || [];
    updateStyleField(paletteField, [...currentPalette, newColor]);
  };

  const updateColor = (index: number, color: string) => {
    const paletteField = styleData?.color_palette ? 'color_palette' : 'palette';
    const currentPalette = styleData?.color_palette || styleData?.palette || [];
    const updatedPalette = [...currentPalette];
    updatedPalette[index] = color;
    updateStyleField(paletteField, updatedPalette);
  };

  const removeColor = (index: number) => {
    const paletteField = styleData?.color_palette ? 'color_palette' : 'palette';
    const currentPalette = styleData?.color_palette || styleData?.palette || [];
    const updatedPalette = currentPalette.filter((_: any, i: number) => i !== index);
    updateStyleField(paletteField, updatedPalette);
  };

  // Helper function to format field keys into readable labels
  const formatFieldLabel = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get all dynamic fields from styleData, excluding special handled fields
  const getDynamicFields = () => {
    if (!styleData) return [];
    
    const excludeFields = ['style_name', 'description', 'color_palette', 'palette', 'renderText'];
    
    return Object.keys(styleData)
      .filter(key => !excludeFields.includes(key))
      .filter(key => {
        const value = styleData[key];
        // Include strings, numbers, and objects (but not null/undefined)
        return value !== null && value !== undefined;
      })
      .sort(); // Sort fields alphabetically for consistent display
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
            {previousStyleData && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handleUndo}
                data-testid="button-undo"
              >
                <Undo className="w-4 h-4" />
                Undo
              </Button>
            )}
            <Button variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Reset
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2"
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
        {/* Left sidebar - References */}
        <div className="w-64 border-r bg-muted/5 p-4 space-y-4">
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              References
            </h3>
            {referenceImageUrl && (
              <div className="aspect-video rounded-md overflow-hidden bg-muted border">
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Chat section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <h3 className="font-medium">Refine with feedback</h3>
            </div>
            <div className="space-y-2">
              <Textarea
                placeholder="Describe changes to refine your style definition..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <Button 
                onClick={handleRefineStyle}
                disabled={refineMutation.isPending || !chatMessage.trim()}
                size="sm" 
                className="w-full gap-2"
              >
                {refineMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Refining...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Refine style definition
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Center - Style Definition */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <Checkbox
                checked={renderText}
                onCheckedChange={(checked) => setRenderText(checked as boolean)}
                id="render-text"
                data-testid="checkbox-render-text"
              />
              <Label htmlFor="render-text" className="text-sm font-medium cursor-pointer">
                Render text
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-blue-600">Style name</Label>
                  <Input
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-blue-600">Description</Label>
                  <Textarea
                    value={styleData?.description || ''}
                    onChange={(e) => setStyleData({ ...styleData, description: e.target.value })}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>

              {/* Color Palette - Handle color_palette or palette */}
              {(styleData?.color_palette || styleData?.palette) && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-blue-600">Color palette</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {((styleData?.color_palette || styleData?.palette) as string[] || []).map((color: string, index: number) => (
                          <div key={index} className="flex items-center gap-1">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => updateColor(index, e.target.value)}
                              className="w-8 h-8 rounded border cursor-pointer"
                            />
                            <span className="text-xs text-muted-foreground font-mono">{color}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeColor(index)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addColor}
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Style Properties */}
              {getDynamicFields().map((key) => {
                const value = styleData[key];
                const isObject = typeof value === 'object' && !Array.isArray(value);
                
                if (isObject) {
                  // Render nested object as a group
                  return (
                    <div key={key} className="space-y-4 col-span-2">
                      <Label className="text-sm font-medium text-blue-600">{formatFieldLabel(key)}</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                        {Object.keys(value).map((nestedKey) => {
                          const nestedValue = value[nestedKey];
                          // Handle arrays within nested objects
                          if (Array.isArray(nestedValue)) {
                            return (
                              <div key={nestedKey} className="space-y-2 col-span-2">
                                <Label className="text-xs text-muted-foreground">{formatFieldLabel(nestedKey)}</Label>
                                <Textarea
                                  value={JSON.stringify(nestedValue, null, 2)}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      updateStyleField(key, { ...value, [nestedKey]: parsed });
                                    } catch {
                                      // Invalid JSON, keep as string
                                      updateStyleField(key, { ...value, [nestedKey]: e.target.value });
                                    }
                                  }}
                                  rows={3}
                                  className="resize-none font-mono text-xs"
                                />
                              </div>
                            );
                          }
                          return (
                            <div key={nestedKey} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{formatFieldLabel(nestedKey)}</Label>
                              <Input
                                value={nestedValue || ''}
                                onChange={(e) => updateStyleField(key, { ...value, [nestedKey]: e.target.value })}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  // Render simple field as textarea
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm font-medium text-blue-600">{formatFieldLabel(key)}</Label>
                      <Textarea
                        value={value || ''}
                        onChange={(e) => updateStyleField(key, e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>

        {/* Right sidebar - Style Preview */}
        <div className="w-80 border-l bg-muted/5 p-4 overflow-y-auto max-h-screen">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Style preview</h3>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleGenerateNewConcept}
                disabled={newConceptMutation.isPending}
                data-testid="button-new-concept"
              >
                <Sparkles className={`w-3 h-3 ${newConceptMutation.isPending ? 'animate-pulse' : ''}`} />
                {newConceptMutation.isPending ? 'Generating...' : 'New prompt'}
              </Button>
            </div>
            
            {/* Concept Prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Concept prompt</Label>
              <Textarea
                value={generatedConcept}
                onChange={(e) => setGeneratedConcept(e.target.value)}
                placeholder="Enter a creative concept for this style..."
                rows={3}
                className="resize-none"
                data-testid="textarea-concept-prompt"
              />
            </div>

            {/* Preview Image */}
            {previewImageUrl ? (
              <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                <img
                  src={previewImageUrl}
                  alt="Style preview"
                  className="w-full h-full object-cover"
                  data-testid="img-style-preview"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <ImageIcon className="w-4 h-4" />
                <p className="text-sm">No preview generated</p>
              </div>
            )}

            {/* Generation Settings */}
            <div className="space-y-3 pt-2 border-t">
              {/* Settings Accordion */}
              <Accordion type="single" collapsible className="w-full" data-testid="accordion-generation-settings">
                <AccordionItem value="generation-settings" className="border-0">
                  <AccordionTrigger className="flex items-center gap-2 py-2 hover:no-underline" data-testid="accordion-trigger-settings">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-medium">Generation Settings</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {/* Model Selection */}
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
                            <SelectItem value="gpt-image-1">GPT Image 1 (supports transparency)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quality Selection */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Quality</Label>
                        <Select
                          value={generationSettings.quality}
                          onValueChange={(value) => updateGenerationSetting('quality', value)}
                        >
                          <SelectTrigger className="h-8" data-testid="select-quality">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="hd">HD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Size Selection */}
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

                      {/* Transparent Background */}
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Transparent background</Label>
                        <Switch
                          checked={generationSettings.transparency}
                          onCheckedChange={(checked) => updateGenerationSetting('transparency', checked)}
                          data-testid="switch-transparency"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Generate Preview Button */}
            <Button
              onClick={handleGeneratePreview}
              disabled={previewMutation.isPending || !generatedConcept.trim()}
              className="w-full"
              data-testid="button-generate-preview"
            >
              {previewMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate preview'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}