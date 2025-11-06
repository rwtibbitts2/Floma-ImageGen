import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  X,
  Sparkles,
  Loader2,
  Info,
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

export default function AIStyleExtractorModal({
  isOpen,
  onClose,
  onStyleSaved,
  editingStyle
}: AIStyleExtractorModalProps) {
  const [step, setStep] = useState<'upload' | 'configure' | 'extract' | 'review'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [userContext, setUserContext] = useState('');
  const [selectedMediaAdapterId, setSelectedMediaAdapterId] = useState<string>('');
  const [extractedStylePrompt, setExtractedStylePrompt] = useState('');
  const [extractedCompositionPrompt, setExtractedCompositionPrompt] = useState('');
  const [extractedConceptPrompt, setExtractedConceptPrompt] = useState('');
  const [extractedMediaAdapterId, setExtractedMediaAdapterId] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch media adapters
  const { data: mediaAdapters, isLoading: isLoadingAdapters } = useQuery({
    queryKey: ['/api/media-adapters'],
    queryFn: api.getMediaAdapters,
  });

  // Set default adapter when adapters load (only if not editing)
  useEffect(() => {
    if (mediaAdapters && mediaAdapters.length > 0 && !selectedMediaAdapterId && !editingStyle) {
      const defaultAdapter = mediaAdapters.find(a => a.isDefault);
      if (defaultAdapter) {
        setSelectedMediaAdapterId(defaultAdapter.id);
      }
    }
  }, [mediaAdapters, selectedMediaAdapterId, editingStyle]);

  // Initialize editing mode
  useEffect(() => {
    if (editingStyle && isOpen) {
      setStep('review');
      setReferenceImageUrl(editingStyle.referenceImageUrl || '');
      setExtractedStylePrompt(editingStyle.stylePrompt || '');
      setExtractedCompositionPrompt(editingStyle.compositionPrompt || '');
      setExtractedConceptPrompt(editingStyle.conceptPrompt || '');
      
      // Initialize media adapter from editing style
      if (editingStyle.mediaAdapterId) {
        setSelectedMediaAdapterId(editingStyle.mediaAdapterId);
        setExtractedMediaAdapterId(editingStyle.mediaAdapterId);
      } else if (mediaAdapters && mediaAdapters.length > 0) {
        // Fallback to default adapter if style has no adapter set
        const defaultAdapter = mediaAdapters.find(a => a.isDefault);
        if (defaultAdapter) {
          setSelectedMediaAdapterId(defaultAdapter.id);
          setExtractedMediaAdapterId(defaultAdapter.id);
        }
      }
    }
  }, [editingStyle, isOpen, mediaAdapters]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/upload-reference-image', {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
  });

  const extractStyleMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/extract-style', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageUrl: referenceImageUrl,
          userContext: userContext || undefined,
          mediaAdapterId: selectedMediaAdapterId || undefined,
        }),
      });
      if (!response.ok) throw new Error('Style extraction failed');
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const stylePayload = {
        name: editingStyle?.name || 'AI Extracted Style',
        stylePrompt: extractedStylePrompt,
        compositionPrompt: extractedCompositionPrompt,
        conceptPrompt: extractedConceptPrompt,
        referenceImageUrl,
        mediaAdapterId: extractedMediaAdapterId,
        isAiExtracted: true,
      };

      if (editingStyle) {
        return api.updateImageStyle(editingStyle.id, stylePayload);
      } else {
        return api.createImageStyle(stylePayload);
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
      setExtractedStylePrompt(result.stylePrompt);
      setExtractedCompositionPrompt(result.compositionPrompt);
      setExtractedConceptPrompt(result.conceptPrompt);
      setExtractedMediaAdapterId(result.mediaAdapterId || null);
      
      // Save and navigate directly to workspace (skip preview)
      const stylePayload = {
        name: editingStyle?.name || 'AI Extracted Style',
        stylePrompt: result.stylePrompt,
        compositionPrompt: result.compositionPrompt,
        conceptPrompt: result.conceptPrompt,
        referenceImageUrl,
        mediaAdapterId: result.mediaAdapterId || null,
        isAiExtracted: true,
      };

      const savedStyle = editingStyle 
        ? await api.updateImageStyle(editingStyle.id, stylePayload)
        : await api.createImageStyle(stylePayload);
      
      setLocation(`/workspace?id=${savedStyle.id}`);
      
      setTimeout(() => {
        onStyleSaved();
        handleClose();
        toast({
          title: 'Style Extracted!',
          description: 'Your style has been saved and opened in the workspace.'
        });
      }, 100);
      
    } catch (error) {
      toast({
        title: 'Extraction Failed',
        description: 'Failed to extract and save style. Please try again.',
        variant: 'destructive'
      });
      setStep('configure');
    }
  };

  const handleSaveAndNavigate = async () => {
    try {
      const savedStyle = await saveMutation.mutateAsync();
      
      setLocation(`/workspace?id=${savedStyle.id}`);
      
      setTimeout(() => {
        onStyleSaved();
        handleClose();
        toast({
          title: 'Style Extracted!',
          description: 'Your style has been saved and opened in the workspace.'
        });
      }, 100);
      
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save the style. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl('');
    setUserContext('');
    setSelectedMediaAdapterId('');
    setExtractedStylePrompt('');
    setExtractedCompositionPrompt('');
    setExtractedConceptPrompt('');
    setExtractedMediaAdapterId(null);
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
              className="max-w-full max-h-64 mx-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              data-testid="img-reference-preview"
              onClick={(e) => {
                e.stopPropagation();
                setZoomedImageUrl(previewUrl);
              }}
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

  const renderConfigureStep = () => {
    const selectedAdapter = mediaAdapters?.find(a => a.id === selectedMediaAdapterId);
    
    return (
      <div className="space-y-6">
        {referenceImageUrl && (
          <div className="space-y-2">
            <Label>Reference Image</Label>
            <div 
              className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setZoomedImageUrl(referenceImageUrl)}
            >
              <img
                src={referenceImageUrl}
                alt="Reference"
                className="w-full h-full object-cover"
                data-testid="img-reference-final"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="media-adapter">Media Type</Label>
          <Select 
            value={selectedMediaAdapterId} 
            onValueChange={setSelectedMediaAdapterId}
            disabled={isLoadingAdapters}
          >
            <SelectTrigger id="media-adapter" data-testid="select-media-adapter">
              <SelectValue placeholder="Select media type" />
            </SelectTrigger>
            <SelectContent>
              {mediaAdapters?.map((adapter) => (
                <SelectItem key={adapter.id} value={adapter.id} data-testid={`option-adapter-${adapter.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  {adapter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAdapter && (
            <div className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg border text-sm">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                {selectedAdapter.description}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            The AI will analyze your reference image and extract three distinct prompts: 
            Style (visual elements), Composition (spatial layout), and Concept (subject generation).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-context">Additional Context (Optional)</Label>
          <Textarea
            id="user-context"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            rows={3}
            placeholder='e.g., "Focus on the lighting and color palette, ignore the background"'
            className="resize-none"
            data-testid="textarea-user-context"
          />
          <p className="text-xs text-muted-foreground">
            Provide any specific guidance for the AI during style extraction
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleExtractStyle}
            disabled={extractStyleMutation.isPending || !selectedMediaAdapterId}
            className="flex-1 gap-2"
            data-testid="button-extract-style"
          >
            <Sparkles className="w-4 h-4" />
            Extract Style
          </Button>
        </div>
      </div>
    );
  };

  const renderExtractStep = () => (
    <div className="text-center space-y-6 py-8">
      <div className="space-y-4">
        <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Analyzing Your Reference Image</h3>
          <p className="text-muted-foreground">
            AI is extracting style, composition, and concept prompts...
          </p>
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      {referenceImageUrl && (
        <div className="space-y-2">
          <Label>Reference Image</Label>
          <div 
            className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setZoomedImageUrl(referenceImageUrl)}
          >
            <img
              src={referenceImageUrl}
              alt="Reference"
              className="w-full h-full object-cover"
              data-testid="img-reference-review"
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Style Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={extractedStylePrompt}
              onChange={(e) => setExtractedStylePrompt(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="textarea-style-prompt"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Describes visual elements: lighting, colors, materials, textures
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composition Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={extractedCompositionPrompt}
              onChange={(e) => setExtractedCompositionPrompt(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="textarea-composition-prompt"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Describes spatial layout: perspective, framing, depth, arrangement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Concept Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={extractedConceptPrompt}
              onChange={(e) => setExtractedConceptPrompt(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="textarea-concept-prompt"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Generates subject ideas: metaphors, themes, creative concepts
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleClose} className="flex-1">
          Cancel
        </Button>
        <Button 
          onClick={handleSaveAndNavigate}
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
              <Sparkles className="w-4 h-4" />
              Save & Open Workspace
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
      case 'review': return 'Review Extracted Prompts';
      default: return 'AI Style Extractor';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'upload': return 'Upload a reference image to extract its visual style';
      case 'configure': return 'Add optional context to guide the extraction process';
      case 'extract': return 'AI is analyzing your image and extracting three distinct prompts';
      case 'review': return 'Review and edit the extracted prompts before saving';
      default: return 'Create reusable styles from reference images using AI';
    }
  };

  return (
    <>
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
            {step === 'review' && renderReviewStep()}
          </div>
        </DialogContent>
      </Dialog>

      {zoomedImageUrl && (
        <Dialog open={!!zoomedImageUrl} onOpenChange={() => setZoomedImageUrl(null)}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
            <img
              src={zoomedImageUrl}
              alt="Zoomed reference"
              className="w-full h-full object-contain"
              data-testid="img-zoomed"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
