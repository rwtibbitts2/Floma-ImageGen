import { useState, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Upload,
  X,
  Sparkles,
  Loader2,
  Save,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { SystemPrompt } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import PromptSelector from '@/components/PromptSelector';
import { queryClient } from '@/lib/queryClient';

interface ConceptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConceptListSaved: () => void;
}

export default function ConceptGeneratorModal({
  isOpen,
  onClose,
  onConceptListSaved,
}: ConceptGeneratorModalProps) {
  const [step, setStep] = useState<'upload' | 'form' | 'generating'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');
  
  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [marketingContent, setMarketingContent] = useState('');
  const [quantity, setQuantity] = useState(5);
  const [selectedPromptId, setSelectedPromptId] = useState<string | undefined>(undefined);
  const [promptText, setPromptText] = useState('');
  
  // Style control sliders
  const [temperature, setTemperature] = useState(0.7);
  const [literalMetaphorical, setLiteralMetaphorical] = useState(0);
  const [simpleComplex, setSimpleComplex] = useState(0);
  
  // Generated data
  const [generatedConcepts, setGeneratedConcepts] = useState<string[]>([]);
  const [conceptListName, setConceptListName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Reset all state when modal closes
  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl('');
    setReferenceImageUrl('');
    setCompanyName('');
    setMarketingContent('');
    setQuantity(5);
    setSelectedPromptId(undefined);
    setPromptText('');
    setTemperature(0.7);
    setLiteralMetaphorical(0);
    setSimpleComplex(0);
    setGeneratedConcepts([]);
    setConceptListName('');
    onClose();
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const removeImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setReferenceImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload image mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return null;
      
      const formData = new FormData();
      formData.append('image', selectedFile);
      
      // Get JWT token for authentication
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
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      return data.url;
    },
    onSuccess: (url) => {
      if (url) {
        setReferenceImageUrl(url);
      }
      setStep('form');
    },
    onError: () => {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload the reference image. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Generate concepts mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await api.generateConceptList({
        companyName,
        referenceImageUrl: referenceImageUrl || undefined,
        marketingContent,
        promptId: selectedPromptId,
        promptText: promptText || undefined,
        quantity,
        temperature,
        literalMetaphorical,
        simpleComplex,
      });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conceptLists'] });
      toast({
        title: 'Concepts Generated',
        description: 'Your concept list has been created successfully.',
      });
      onConceptListSaved();
      handleClose();
      setLocation(`/concepts/${data.id}`);
    },
    onError: () => {
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate concepts. Please try again.',
        variant: 'destructive',
      });
      setStep('form');
    },
  });


  const handleUploadAndContinue = () => {
    if (selectedFile) {
      uploadMutation.mutate();
    } else {
      setStep('form');
    }
  };

  const handleSkip = () => {
    setStep('form');
  };

  const handleBack = () => {
    setStep('upload');
  };

  const handleGenerate = () => {
    if (!companyName.trim() || !marketingContent.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both company name and marketing content.',
        variant: 'destructive',
      });
      return;
    }
    
    setStep('generating');
    generateMutation.mutate();
  };

  const handlePromptSelect = (prompt: SystemPrompt) => {
    setSelectedPromptId(prompt.id);
    setPromptText(prompt.promptText);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Marketing Concepts</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a reference image (optional) or skip to proceed'}
            {step === 'form' && 'Provide company details and marketing content'}
            {step === 'generating' && 'Generating your concepts...'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              data-testid="dropzone-reference-image"
            >
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Reference preview"
                    className="max-h-64 mx-auto rounded-md"
                    data-testid="img-preview"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                    data-testid="button-remove-image"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Drop your reference image here</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                    data-testid="input-file"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-browse"
                  >
                    Browse Files
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={handleSkip}
                data-testid="button-skip"
              >
                Skip
              </Button>
              <Button
                onClick={handleUploadAndContinue}
                disabled={uploadMutation.isPending}
                data-testid="button-upload-continue"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    {selectedFile ? 'Upload & Continue' : 'Continue'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Form */}
        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
                data-testid="input-company-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketing-content">
                Marketing Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="marketing-content"
                value={marketingContent}
                onChange={(e) => setMarketingContent(e.target.value)}
                placeholder="Paste your marketing content, product descriptions, or campaign details here..."
                className="min-h-[150px]"
                data-testid="textarea-marketing-content"
              />
            </div>

            <PromptSelector
              category="concept_generation"
              selectedPromptId={selectedPromptId}
              onPromptSelect={handlePromptSelect}
              label="Concept Generation Prompt"
              description="Select a prompt template for generating concepts"
            />

            <div className="space-y-2">
              <Label htmlFor="quantity">
                Number of Concepts (1-10)
              </Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 5)}
                data-testid="input-quantity"
              />
            </div>

            {/* Style Control Sliders */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">
                    Temperature
                  </Label>
                  <span className="text-sm text-muted-foreground" data-testid="text-temperature-value">
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[temperature]}
                  onValueChange={(values) => setTemperature(values[0])}
                  data-testid="slider-temperature"
                />
                <p className="text-xs text-muted-foreground">
                  Lower values produce more consistent, focused results. Higher values increase creativity and variation.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="literal-metaphorical">
                    Style Spectrum
                  </Label>
                  <span className="text-sm text-muted-foreground" data-testid="text-literal-metaphorical-value">
                    {literalMetaphorical < -0.3 ? 'Literal' : literalMetaphorical > 0.3 ? 'Metaphorical' : 'Balanced'}
                  </span>
                </div>
                <Slider
                  id="literal-metaphorical"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={[literalMetaphorical]}
                  onValueChange={(values) => setLiteralMetaphorical(values[0])}
                  data-testid="slider-literal-metaphorical"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Literal, concrete descriptions</span>
                  <span>Metaphorical, abstract imagery</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="simple-complex">
                    Subject Complexity
                  </Label>
                  <span className="text-sm text-muted-foreground" data-testid="text-simple-complex-value">
                    {simpleComplex < -0.3 ? 'Simple' : simpleComplex > 0.3 ? 'Complex' : 'Moderate'}
                  </span>
                </div>
                <Slider
                  id="simple-complex"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={[simpleComplex]}
                  onValueChange={(values) => setSimpleComplex(values[0])}
                  data-testid="slider-simple-complex"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Single, clear subjects</span>
                  <span>Multi-layered compositions</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                data-testid="button-generate"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Concepts
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === 'generating' && (
          <div className="py-8 space-y-4">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
            <p className="text-center text-muted-foreground">
              Generating concepts based on your marketing content...
            </p>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
