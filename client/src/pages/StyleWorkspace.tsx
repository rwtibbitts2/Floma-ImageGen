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
  Image as ImageIcon
} from 'lucide-react';
import { ImageStyle } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  
  // Debug logging
  console.log('Current location:', location);
  console.log('Full URL search:', fullUrl);
  console.log('URL params:', urlParams.toString());
  console.log('Extracted styleId:', styleId);
  
  // State for style data
  const [styleName, setStyleName] = useState('');
  const [description, setDescription] = useState('');
  const [styleData, setStyleData] = useState<any>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [chatMessage, setChatMessage] = useState('');

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
      setDescription(style.description || '');
      setStyleData(style.aiStyleData || {});
      setPreviewImageUrl(style.previewImageUrl || '');
      setReferenceImageUrl(style.referenceImageUrl || '');
    }
  }, [style]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!styleId) return;
      
      const updateData = {
        name: styleName,
        description,
        stylePrompt: styleData?.style_name ? `${styleData.style_name}: ${styleData.description}` : styleData?.description || 'AI-extracted style',
        aiStyleData: styleData,
        previewImageUrl,
        referenceImageUrl,
      };
      
      return api.updateImageStyle(styleId, updateData);
    },
  });

  // Preview generation mutation
  const previewMutation = useMutation({
    mutationFn: async (concept: string) => {
      const stylePrompt = styleData?.style_name ? `${styleData.style_name}: ${styleData.description}` : styleData?.description || 'AI-extracted style';
      const response = await fetch('/api/generate-style-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleData: {
            style: stylePrompt
          },
          concept: concept,
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

  const handleGeneratePreview = async () => {
    if (!chatMessage.trim()) {
      toast({
        title: 'Concept Required',
        description: 'Please enter a concept to generate a preview.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = await previewMutation.mutateAsync(chatMessage);
      setPreviewImageUrl(result.imageUrl);
      setChatMessage('');
      toast({
        title: 'Preview Generated',
        description: 'Your style preview has been generated successfully.'
      });
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: 'Failed to generate preview. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const updateStyleField = (field: string, value: any, nestedField?: string) => {
    setStyleData((prev: any) => {
      const updated = { ...prev };
      if (nestedField) {
        updated[field] = { ...updated[field], [nestedField]: value };
      } else {
        updated[field] = value;
      }
      return updated;
    });
  };

  const addColor = () => {
    const newColor = '#000000';
    updateStyleField('color_palette', [...(styleData.color_palette || []), newColor]);
  };

  const updateColor = (index: number, color: string) => {
    const updatedPalette = [...(styleData.color_palette || [])];
    updatedPalette[index] = color;
    updateStyleField('color_palette', updatedPalette);
  };

  const removeColor = (index: number) => {
    const updatedPalette = styleData.color_palette?.filter((_: any, i: number) => i !== index) || [];
    updateStyleField('color_palette', updatedPalette);
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
                placeholder="Describe changes or generate a preview..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <Button 
                onClick={handleGeneratePreview}
                disabled={previewMutation.isPending || !chatMessage.trim()}
                size="sm" 
                className="w-full gap-2"
              >
                {previewMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Generate preview
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Center - Style Definition */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm font-medium">Render text</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Transparent background</span>
              </div>
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
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>

              {/* Color Palette */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-blue-600">Color palette</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(styleData.color_palette || []).map((color: string, index: number) => (
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

              {/* Style Properties */}
              {[
                { key: 'color_usage', label: 'Color usage' },
                { key: 'lighting', label: 'Lighting' },
                { key: 'shadow_style', label: 'Shadow style' },
                { key: 'shapes', label: 'Shapes' },
                { key: 'shape_edges', label: 'Shape edges' },
                { key: 'symmetry_balance', label: 'Symmetry' },
                { key: 'line_quality', label: 'Line quality' },
                { key: 'line_color_treatment', label: 'Line color' },
                { key: 'texture', label: 'Texture' },
                { key: 'material_suggestion', label: 'Material' },
                { key: 'rendering_style', label: 'Rendering style' },
                { key: 'detail_level', label: 'Detail level' },
                { key: 'perspective', label: 'Perspective' },
                { key: 'scale_relationships', label: 'Scale relationships' },
                { key: 'composition', label: 'Composition' },
                { key: 'visual_hierarchy', label: 'Visual hierarchy' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm font-medium text-blue-600">{label}</Label>
                  <Textarea
                    value={styleData[key] || ''}
                    onChange={(e) => updateStyleField(key, e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              ))}

              {/* Typography */}
              <div className="space-y-4">
                <Label className="text-sm font-medium text-blue-600">Typography</Label>
                {[
                  { key: 'font_styles', label: 'Font styles' },
                  { key: 'font_weights', label: 'Font weight' },
                  { key: 'case_usage', label: 'Case usage' },
                  { key: 'alignment', label: 'Alignment' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      value={styleData.typography?.[key] || ''}
                      onChange={(e) => updateStyleField('typography', e.target.value, key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - Example Output */}
        <div className="w-80 border-l bg-muted/5 p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Example output</h3>
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-3 h-3" />
                New prompt
              </Button>
            </div>
            
            {previewImageUrl ? (
              <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                <img
                  src={previewImageUrl}
                  alt="Style preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-lg bg-muted border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">No preview generated</p>
                  <p className="text-xs">Use the chat to generate a preview</p>
                </div>
              </div>
            )}

            {previewImageUrl && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Generated using concept: "{chatMessage}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}