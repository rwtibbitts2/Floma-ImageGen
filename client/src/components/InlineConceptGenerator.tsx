import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Sparkles, Loader2, RefreshCw, Check } from 'lucide-react';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import PromptSelector from '@/components/PromptSelector';

interface InlineConceptGeneratorProps {
  onConceptsGenerated: (concepts: string[]) => void;
  onCancel: () => void;
}

export default function InlineConceptGenerator({ onConceptsGenerated, onCancel }: InlineConceptGeneratorProps) {
  const [mode, setMode] = useState<'input' | 'results'>('input');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');
  
  // Form fields
  const [marketingContent, setMarketingContent] = useState('');
  const [userInstruction, setUserInstruction] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | undefined>(undefined);
  const [promptText, setPromptText] = useState('');
  const [promptInitialized, setPromptInitialized] = useState(false);
  
  // Style control sliders
  const [temperature, setTemperature] = useState(0.7);
  const [literalMetaphorical, setLiteralMetaphorical] = useState(0);
  const [simpleComplex, setSimpleComplex] = useState(0);
  
  // Generated data
  const [generatedConcepts, setGeneratedConcepts] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  
  // Conversation history for refinements
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load system prompts
  const { data: conceptPrompts = [] } = useQuery({
    queryKey: ['systemPrompts', 'concept_generation'],
    queryFn: () => api.getSystemPromptsByCategory('concept_generation'),
  });

  // Auto-select default prompt on mount
  useEffect(() => {
    if (!promptInitialized && conceptPrompts.length > 0) {
      const defaultPrompt = conceptPrompts.find(p => p.isDefault);
      if (defaultPrompt) {
        setSelectedPromptId(defaultPrompt.id);
        setPromptText(defaultPrompt.promptText);
      }
      setPromptInitialized(true);
    }
  }, [promptInitialized, conceptPrompts]);

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

  const removeImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setReferenceImageUrl('');
  };

  // Upload image mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
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
      return data;
    },
  });

  // Generate concepts mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Upload image if selected and not already uploaded
      let imageUrl = referenceImageUrl;
      if (selectedFile && !referenceImageUrl) {
        const result = await uploadMutation.mutateAsync(selectedFile);
        imageUrl = result.url;
        setReferenceImageUrl(result.url);
      }

      // Combine user instruction with marketing content
      const fullContent = userInstruction 
        ? `${marketingContent}\n\nAdditional Instructions: ${userInstruction}`
        : marketingContent;

      return api.generateConceptList({
        companyName: 'Visual Concept Generation',
        marketingContent: fullContent,
        referenceImageUrl: imageUrl,
        promptId: selectedPromptId,
        promptText: promptText,
        quantity: 5,
        temperature,
        literalMetaphorical,
        simpleComplex,
      });
    },
    onSuccess: (data) => {
      const concepts = data.concepts.map(c => c.concept || (typeof c === 'string' ? c : ''));
      setGeneratedConcepts(concepts);
      
      // Initialize conversation history with the original request and response
      const initialHistory = [
        {
          role: 'user' as const,
          content: userInstruction 
            ? `${marketingContent}\n\nAdditional Instructions: ${userInstruction}`
            : marketingContent
        },
        {
          role: 'assistant' as const,
          content: concepts.join('\n')
        }
      ];
      setConversationHistory(initialHistory);
      
      setMode('results');
      toast({
        title: 'Concepts Generated',
        description: `Generated ${data.concepts.length} visual concepts`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate concepts',
        variant: 'destructive',
      });
    },
  });

  // Refine concepts mutation
  const refineMutation = useMutation({
    mutationFn: async () => {
      if (!feedbackText.trim()) {
        throw new Error('Please provide feedback for refinement');
      }

      // Build conversation context with full history
      const conversationContext = conversationHistory.map(msg => 
        `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}: ${msg.content}`
      ).join('\n\n');
      
      const fullContent = `${conversationContext}\n\nUSER: ${feedbackText}`;

      return api.generateConceptList({
        companyName: 'Visual Concept Generation',
        marketingContent: fullContent,
        referenceImageUrl,
        promptId: selectedPromptId,
        promptText: promptText,
        quantity: 5,
        temperature,
        literalMetaphorical,
        simpleComplex,
      });
    },
    onSuccess: (data) => {
      const concepts = data.concepts.map(c => c.concept || (typeof c === 'string' ? c : ''));
      setGeneratedConcepts(concepts);
      
      // Update conversation history with the refinement exchange
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: feedbackText },
        { role: 'assistant', content: concepts.join('\n') }
      ]);
      
      setFeedbackText('');
      toast({
        title: 'Concepts Refined',
        description: `Updated concepts based on your feedback`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Refinement Failed',
        description: error instanceof Error ? error.message : 'Failed to refine concepts',
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    if (!marketingContent.trim()) {
      toast({
        title: 'Missing Content',
        description: 'Please provide marketing content or product description',
        variant: 'destructive',
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleRefine = () => {
    refineMutation.mutate();
  };

  const handleUseConcepts = () => {
    onConceptsGenerated(generatedConcepts);
    toast({
      title: 'Concepts Applied',
      description: `${generatedConcepts.length} concepts ready for generation`,
    });
  };

  const handleStartOver = () => {
    setMode('input');
    setGeneratedConcepts([]);
    setFeedbackText('');
    setConversationHistory([]);
  };

  if (mode === 'results') {
    return (
      <div className="space-y-4">
        {/* Results Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Generated Concepts</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartOver}
            data-testid="button-start-over"
          >
            <X className="w-4 h-4 mr-1" />
            Start Over
          </Button>
        </div>

        {/* Plain Text Concepts */}
        <div className="space-y-2 rounded-md border bg-muted/30 p-4">
          {generatedConcepts.map((concept, index) => (
            <div
              key={index}
              className="text-sm leading-relaxed border-l-2 border-primary/30 pl-3 py-1"
              data-testid={`concept-result-${index}`}
            >
              {concept}
            </div>
          ))}
        </div>

        {/* Advanced Settings for Regeneration */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger className="text-sm py-2" data-testid="accordion-advanced-settings">
              Adjust Settings & Regenerate
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Temperature Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">Creativity</Label>
                  <span className="text-xs text-muted-foreground">{temperature.toFixed(1)}</span>
                </div>
                <Slider
                  value={[temperature]}
                  onValueChange={(value) => setTemperature(value[0])}
                  min={0}
                  max={1}
                  step={0.1}
                  data-testid="slider-temperature-results"
                />
                <p className="text-xs text-muted-foreground">
                  Lower = More focused, Higher = More creative
                </p>
              </div>

              {/* Literal/Metaphorical Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">Style Spectrum</Label>
                  <span className="text-xs text-muted-foreground">
                    {literalMetaphorical < -0.3 ? 'Literal' : literalMetaphorical > 0.3 ? 'Metaphorical' : 'Balanced'}
                  </span>
                </div>
                <Slider
                  value={[literalMetaphorical]}
                  onValueChange={(value) => setLiteralMetaphorical(value[0])}
                  min={-1}
                  max={1}
                  step={0.1}
                  data-testid="slider-literal-metaphorical-results"
                />
                <p className="text-xs text-muted-foreground">
                  Literal ← → Metaphorical
                </p>
              </div>

              {/* Simple/Complex Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">Subject Complexity</Label>
                  <span className="text-xs text-muted-foreground">
                    {simpleComplex < -0.3 ? 'Simple' : simpleComplex > 0.3 ? 'Complex' : 'Moderate'}
                  </span>
                </div>
                <Slider
                  value={[simpleComplex]}
                  onValueChange={(value) => setSimpleComplex(value[0])}
                  min={-1}
                  max={1}
                  step={0.1}
                  data-testid="slider-simple-complex-results"
                />
                <p className="text-xs text-muted-foreground">
                  Simple ← → Complex composition
                </p>
              </div>

              {/* Regenerate Button */}
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full"
                data-testid="button-regenerate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Regenerate with New Settings
                  </>
                )}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Conversational Feedback */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="feedback-input" className="text-sm font-medium">
              Refine these concepts (optional)
            </Label>
            {conversationHistory.length > 2 && (
              <span className="text-xs text-muted-foreground">
                {(conversationHistory.length - 2) / 2} refinement{(conversationHistory.length - 2) / 2 !== 1 ? 's' : ''} applied
              </span>
            )}
          </div>
          <Textarea
            id="feedback-input"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="E.g., 'Make them more abstract' or 'Focus on outdoor scenes' or 'Add more color descriptions'"
            className="min-h-20"
            data-testid="textarea-feedback"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleRefine}
            disabled={refineMutation.isPending || !feedbackText.trim()}
            variant="outline"
            className="flex-1"
            data-testid="button-refine"
          >
            {refineMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refine
              </>
            )}
          </Button>
          <Button
            onClick={handleUseConcepts}
            className="flex-1"
            data-testid="button-use-concepts"
          >
            <Check className="w-4 h-4 mr-2" />
            Use These Concepts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reference Image Upload */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Reference Image (Optional)</Label>
        {!previewUrl ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-reference-image"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop an image or click to upload
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              data-testid="input-reference-image"
            />
          </div>
        ) : (
          <Card>
            <CardContent className="p-3">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Reference"
                  className="w-full h-32 object-cover rounded-md"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={removeImage}
                  data-testid="button-remove-image"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Marketing Content */}
      <div className="space-y-2">
        <Label htmlFor="marketing-content" className="text-sm font-medium">
          Marketing Content / Product Description
        </Label>
        <Textarea
          id="marketing-content"
          value={marketingContent}
          onChange={(e) => setMarketingContent(e.target.value)}
          placeholder="Paste your marketing content, product description, or campaign details here..."
          className="min-h-24"
          data-testid="textarea-marketing-content"
        />
      </div>

      {/* User Instruction */}
      <div className="space-y-2">
        <Label htmlFor="user-instruction" className="text-sm font-medium">
          Additional Instructions (Optional)
        </Label>
        <Input
          id="user-instruction"
          value={userInstruction}
          onChange={(e) => setUserInstruction(e.target.value)}
          placeholder="E.g., 'Focus on outdoor scenes' or 'Use warm colors'"
          data-testid="input-user-instruction"
        />
      </div>

      {/* Prompt Selector */}
      <PromptSelector
        category="concept_generation"
        selectedPromptId={selectedPromptId}
        onPromptSelect={(prompt) => {
          setSelectedPromptId(prompt.id);
          setPromptText(prompt.promptText);
        }}
      />

      {/* Advanced Settings */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
            Advanced Settings
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Temperature (Creativity)</Label>
                <span className="text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={(value) => setTemperature(value[0])}
                min={0}
                max={1}
                step={0.1}
                data-testid="slider-temperature"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Focused</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Literal / Metaphorical */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Style Spectrum</Label>
                <span className="text-sm text-muted-foreground">
                  {literalMetaphorical < -0.3 ? 'Literal' : literalMetaphorical > 0.3 ? 'Metaphorical' : 'Balanced'}
                </span>
              </div>
              <Slider
                value={[literalMetaphorical]}
                onValueChange={(value) => setLiteralMetaphorical(value[0])}
                min={-1}
                max={1}
                step={0.1}
                data-testid="slider-literal-metaphorical"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Literal</span>
                <span>Metaphorical</span>
              </div>
            </div>

            {/* Simple / Complex */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Subject Complexity</Label>
                <span className="text-sm text-muted-foreground">
                  {simpleComplex < -0.3 ? 'Simple' : simpleComplex > 0.3 ? 'Complex' : 'Balanced'}
                </span>
              </div>
              <Slider
                value={[simpleComplex]}
                onValueChange={(value) => setSimpleComplex(value[0])}
                min={-1}
                max={1}
                step={0.1}
                data-testid="slider-simple-complex"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Simple</span>
                <span>Complex</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          data-testid="button-cancel-generation"
        >
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending || !marketingContent.trim()}
          className="flex-1"
          data-testid="button-generate-concepts"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Concepts
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
