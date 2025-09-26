import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Upload,
  X,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Save,
  Eye,
  RefreshCw
} from 'lucide-react';
import { ImageStyle } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AIStyleExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStyleSaved: () => void;
  editingStyle?: ImageStyle | null;
}

// Default prompts
const DEFAULT_EXTRACTION_PROMPT = `Role: You are an expert visual analyst and systematizer. Goal: Analyze the provided reference image and output a single JSON object that captures only its reusable visual style — never its subject matter, narrative, brand, or specific content. Output Format (single JSON object only) { "style_name": "", "description": "", "color_palette": ["#RRGGBB"], "color_usage": "", "lighting": "", "shadow_style": "", "shapes": "", "shape_edges": "", "symmetry_balance": "", "line_quality": "", "line_color_treatment": "", "texture": "", "material_suggestion": "", "rendering_style": "", "detail_level": "", "perspective": "", "scale_relationships": "", "composition": "", "visual_hierarchy": "", "typography": { "font_styles": "", "font_weights": "", "case_usage": "", "alignment": "", "letter_spacing": "", "text_treatment": "" }, "ui_elements": { "corner_radius": "", "icon_style": "", "button_style": "", "spacing_rhythm": "" }, "motion_or_interaction": "", "notable_visual_effects": "" } Strict Rules No content/subject references: Do not mention people, objects, locations, logos, words in the image, brand names, IP, or narrative elements. Style only: Describe visual treatment (e.g., "isometric perspective," "soft diffused lighting," "grainy texture") rather than what is depicted. Neutral, reusable language: Prefer generic terms ("rounded pill buttons," "duotone icons") over any brand cues. Fill every field: If a field truly does not apply or is not visible, use "none" (string) — not null/empty — to preserve schema consistency. Quantify/qualify where possible: Use clear qualifiers (e.g., "high contrast," "low saturation," "2–4 px stroke," "8–12 px corner radius"). Color palette: Provide 5–8 representative colors in uppercase HEX (#RRGGBB). Include both background/base tones and accent colors when visible. If gradients dominate, include both endpoints as separate swatches. Typography & UI: Only populate if visible/inferable from the image. Otherwise set each field to "none". One JSON object only: No prose before/after. No markdown. No comments. Output only the JSON object as specified.`;

const DEFAULT_CONCEPT_PROMPT = `Based on the visual style you just analyzed, generate a single creative concept that would work well with this style. Return only a short, descriptive concept phrase (2-5 words) that could be used as a prompt for image generation. Examples: "mysterious forest clearing", "vintage coffee shop", "futuristic city skyline"`;

export default function AIStyleExtractorModal({
  isOpen,
  onClose,
  onStyleSaved,
  editingStyle
}: AIStyleExtractorModalProps) {
  const [step, setStep] = useState<'upload' | 'configure' | 'extract'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [styleName, setStyleName] = useState('');
  const [description, setDescription] = useState('');
  const [extractionPrompt, setExtractionPrompt] = useState(DEFAULT_EXTRACTION_PROMPT);
  const [conceptPrompt, setConceptPrompt] = useState(DEFAULT_CONCEPT_PROMPT);
  const [extractedStyleData, setExtractedStyleData] = useState<any>(null);
  const [generatedConcept, setGeneratedConcept] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Initialize editing mode
  useEffect(() => {
    if (editingStyle && isOpen) {
      setStep('configure');
      setStyleName(editingStyle.name);
      setDescription(editingStyle.description || '');
      setExtractionPrompt(editingStyle.extractionPrompt || DEFAULT_EXTRACTION_PROMPT);
      setConceptPrompt(editingStyle.conceptPrompt || DEFAULT_CONCEPT_PROMPT);
      setReferenceImageUrl(editingStyle.referenceImageUrl || '');
      setPreviewImageUrl(editingStyle.previewImageUrl || '');
      if (editingStyle.aiStyleData) {
        setExtractedStyleData(editingStyle.aiStyleData);
      }
    }
  }, [editingStyle, isOpen]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/upload-reference-image', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
  });

  const extractStyleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/extract-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: referenceImageUrl,
          extractionPrompt,
          conceptPrompt,
        }),
      });
      if (!response.ok) throw new Error('Style extraction failed');
      return response.json();
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/generate-style-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleData: extractedStyleData,
          concept: generatedConcept,
        }),
      });
      if (!response.ok) throw new Error('Preview generation failed');
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const styleData = {
        name: styleName,
        description,
        stylePrompt: extractedStyleData.style_name ? `${extractedStyleData.style_name}: ${extractedStyleData.description}` : extractedStyleData.description || 'AI-extracted style',
        referenceImageUrl,
        isAiExtracted: true,
        extractionPrompt,
        conceptPrompt,
        aiStyleData: extractedStyleData,
        previewImageUrl,
      };

      if (editingStyle) {
        return api.updateImageStyle(editingStyle.id, styleData);
      } else {
        return api.createImageStyle(styleData);
      }
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      const result = await uploadMutation.mutateAsync(selectedFile);
      setReferenceImageUrl(result.url);
      setStep('configure');
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload the reference image. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleExtractStyle = async () => {
    setStep('extract');
    try {
      const result = await extractStyleMutation.mutateAsync();
      setExtractedStyleData(result.styleData);
      setGeneratedConcept(result.concept);
      setStep('preview');
    } catch (error) {
      toast({
        title: 'Extraction Failed',
        description: 'Failed to extract style from the image. Please try again.',
        variant: 'destructive'
      });
      setStep('configure');
    }
  };

  const handleGeneratePreview = async () => {
    try {
      const result = await previewMutation.mutateAsync();
      setPreviewImageUrl(result.imageUrl);
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: 'Failed to generate preview image. You can still save the style.',
        variant: 'destructive'
      });
    }
  };

  const handleSave = async () => {
    if (!styleName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for this style.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await saveMutation.mutateAsync();
      onStyleSaved();
      handleClose();
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save the style. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleClose = () => {
    // Reset all state
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl('');
    setStyleName('');
    setDescription('');
    setExtractionPrompt(DEFAULT_EXTRACTION_PROMPT);
    setConceptPrompt(DEFAULT_CONCEPT_PROMPT);
    setExtractedStyleData(null);
    setGeneratedConcept('');
    setPreviewImageUrl('');
    setReferenceImageUrl('');
    onClose();
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="dropzone-reference-image"
      >
        {previewUrl ? (
          <div className="space-y-4">
            <img
              src={previewUrl}
              alt="Reference preview"
              className="max-w-full max-h-64 mx-auto rounded-lg"
              data-testid="img-reference-preview"
            />
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                setPreviewUrl('');
              }}
              className="gap-2"
              data-testid="button-remove-image"
            >
              <X className="w-4 h-4" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Upload Reference Image</p>
              <p className="text-muted-foreground">
                Drop an image here or click to browse
              </p>
            </div>
          </div>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-reference"
      />

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleClose} className="flex-1">
          Cancel
        </Button>
        <Button 
          onClick={handleUpload}
          disabled={!selectedFile || uploadMutation.isPending}
          className="flex-1 gap-2"
          data-testid="button-upload-reference"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload & Continue
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderConfigureStep = () => (
    <div className="space-y-6">
      {referenceImageUrl && (
        <div className="space-y-2">
          <Label>Reference Image</Label>
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={referenceImageUrl}
              alt="Reference"
              className="w-full h-full object-cover"
              data-testid="img-reference-final"
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="style-name">Style Name *</Label>
          <Input
            id="style-name"
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
            placeholder="e.g., Vintage Photography"
            data-testid="input-style-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            data-testid="input-description"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="extraction-prompt">Style Extraction Prompt</Label>
          <Textarea
            id="extraction-prompt"
            value={extractionPrompt}
            onChange={(e) => setExtractionPrompt(e.target.value)}
            rows={6}
            className="resize-none"
            data-testid="textarea-extraction-prompt"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="concept-prompt">Concept Generation Prompt</Label>
          <Textarea
            id="concept-prompt"
            value={conceptPrompt}
            onChange={(e) => setConceptPrompt(e.target.value)}
            rows={4}
            className="resize-none"
            data-testid="textarea-concept-prompt"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleClose} className="flex-1">
          Cancel
        </Button>
        <Button 
          onClick={handleExtractStyle}
          disabled={!styleName.trim() || extractStyleMutation.isPending}
          className="flex-1 gap-2"
          data-testid="button-extract-style"
        >
          <Sparkles className="w-4 h-4" />
          Extract Style
        </Button>
      </div>
    </div>
  );

  const renderExtractStep = () => (
    <div className="text-center space-y-6 py-8">
      <div className="space-y-4">
        <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Analyzing Your Reference Image</h3>
          <p className="text-muted-foreground">
            GPT-5 is extracting the visual style and generating a concept...
          </p>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Extracted Style Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4" />
              Extracted Style
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {extractedStyleData && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Style Description
                  </Label>
                  <p className="text-sm" data-testid="text-extracted-style">
                    {extractedStyleData.style_name && extractedStyleData.description
                      ? `${extractedStyleData.style_name}: ${extractedStyleData.description}`
                      : extractedStyleData.description || 'Style analysis completed'}
                  </p>
                </div>
                
                {extractedStyleData.lighting && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      Lighting
                    </Label>
                    <Badge variant="secondary" data-testid="badge-lighting">
                      {extractedStyleData.lighting}
                    </Badge>
                  </div>
                )}

                {extractedStyleData.color_palette && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      Color Palette
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {extractedStyleData.color_palette.map((color: string, index: number) => (
                        <div key={index} className="flex items-center gap-1 text-xs">
                          <div className="w-3 h-3 rounded border" style={{ backgroundColor: color }}></div>
                          <span>{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Generated Concept */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="w-4 h-4" />
              Generated Concept
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Concept Prompt
              </Label>
              <p className="text-sm font-medium" data-testid="text-generated-concept">
                {generatedConcept}
              </p>
            </div>
            
            <Button
              variant="outline"
              onClick={handleGeneratePreview}
              disabled={previewMutation.isPending}
              className="w-full gap-2"
              data-testid="button-generate-preview"
            >
              {previewMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Generate Preview
                </>
              )}
            </Button>

            {previewImageUrl && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Preview Image
                </Label>
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <img
                    src={previewImageUrl}
                    alt="Style preview"
                    className="w-full h-full object-cover"
                    data-testid="img-style-preview"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={() => setStep('configure')} 
          className="flex-1 gap-2"
          data-testid="button-back-to-configure"
        >
          <RefreshCw className="w-4 h-4" />
          Refine Settings
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex-1 gap-2"
          data-testid="button-save-style"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Style
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case 'upload': return 'Upload Reference Image';
      case 'configure': return 'Configure Style Extraction';
      case 'extract': return 'Extracting Style';
      case 'preview': return 'Review & Save Style';
      default: return 'AI Style Extractor';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'upload': return 'Upload a reference image to extract its visual style';
      case 'configure': return 'Configure the extraction prompts and style details';
      case 'extract': return 'AI is analyzing your image and extracting style elements';
      case 'preview': return 'Review the extracted style and generate a preview';
      default: return 'Create reusable styles from reference images using AI';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-ai-style-extractor">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {step === 'upload' && renderUploadStep()}
          {step === 'configure' && renderConfigureStep()}
          {step === 'extract' && renderExtractStep()}
          {step === 'preview' && renderPreviewStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}