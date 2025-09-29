import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  const [step, setStep] = useState<'upload' | 'form' | 'generating' | 'review'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');
  
  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [marketingContent, setMarketingContent] = useState('');
  const [quantity, setQuantity] = useState(5);
  const [selectedPromptId, setSelectedPromptId] = useState<string | undefined>(undefined);
  const [promptText, setPromptText] = useState('');
  
  // Generated data
  const [generatedConcepts, setGeneratedConcepts] = useState<string[]>([]);
  const [conceptListName, setConceptListName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      });
      return result;
    },
    onSuccess: (data) => {
      setGeneratedConcepts(data.concepts);
      setConceptListName(data.name);
      setStep('review');
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

  // Save concept list mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // The concept list is already created, we just need to update the name if changed
      const lists = await api.getConceptLists();
      const latestList = lists[0]; // Get the most recent one
      
      if (latestList && latestList.name !== conceptListName) {
        await api.updateConceptList(latestList.id, {
          name: conceptListName,
        });
      }
      
      return latestList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptLists'] });
      toast({
        title: 'Concept List Saved',
        description: 'Your concept list has been saved successfully.',
      });
      onConceptListSaved();
      handleClose();
    },
    onError: () => {
      toast({
        title: 'Save Failed',
        description: 'Failed to save the concept list. Please try again.',
        variant: 'destructive',
      });
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

  const handleGenerateAgain = () => {
    setStep('form');
    setGeneratedConcepts([]);
    setConceptListName('');
  };

  const handlePromptSelect = (prompt: SystemPrompt) => {
    setSelectedPromptId(prompt.id);
    setPromptText(prompt.promptText);
  };

  const handleConceptChange = (index: number, value: string) => {
    const updated = [...generatedConcepts];
    updated[index] = value;
    setGeneratedConcepts(updated);
  };

  const handleAddConcept = () => {
    setGeneratedConcepts([...generatedConcepts, '']);
  };

  const handleRemoveConcept = (index: number) => {
    setGeneratedConcepts(generatedConcepts.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Marketing Concepts</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a reference image (optional) or skip to proceed'}
            {step === 'form' && 'Provide company details and marketing content'}
            {step === 'generating' && 'Generating your marketing concepts...'}
            {step === 'review' && 'Review and save your generated concepts'}
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

        {/* Step 4: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">Concept List Name</Label>
              <Input
                id="list-name"
                value={conceptListName}
                onChange={(e) => setConceptListName(e.target.value)}
                placeholder="Enter a name for this concept list"
                data-testid="input-list-name"
              />
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              <div className="flex items-center justify-between">
                <Label>Generated Concepts ({generatedConcepts.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddConcept}
                  data-testid="button-add-concept"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              
              {generatedConcepts.map((concept, index) => (
                <Card key={index} data-testid={`card-concept-${index}`}>
                  <CardContent className="pt-4">
                    <div className="flex gap-2">
                      <Input
                        value={concept}
                        onChange={(e) => handleConceptChange(index, e.target.value)}
                        placeholder={`Concept ${index + 1}`}
                        data-testid={`input-concept-${index}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemoveConcept(index)}
                        data-testid={`button-remove-concept-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 justify-between">
              <Button
                variant="outline"
                onClick={handleGenerateAgain}
                data-testid="button-generate-again"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Again
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !conceptListName.trim()}
                data-testid="button-save"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Concept List
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
