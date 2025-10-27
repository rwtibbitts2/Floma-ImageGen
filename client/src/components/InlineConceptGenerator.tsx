import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Sparkles, Loader2, RefreshCw, Check, Undo, Plus, Wand2 } from 'lucide-react';
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
  
  // Checkbox selection state for selective refinement
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  
  // Conversation history for refinements
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  
  // Previous state for undo
  const [previousState, setPreviousState] = useState<{
    concepts: string[];
    history: Array<{ role: 'user' | 'assistant', content: string }>;
  } | null>(null);
  
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

      // Determine which concepts to refine and build instruction
      if (selectedIndices.size > 0) {
        // Selective refinement - preserve order of selection
        const selectedIndicesArray = Array.from(selectedIndices);
        const selectedConcepts = selectedIndicesArray.map(idx => generatedConcepts[idx]);
        
        const refinementInstruction = `Apply the following feedback ONLY to these specific concepts:\n${selectedConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nFeedback: ${feedbackText}\n\nKeep all other concepts unchanged.`;
        const fullContent = `${conversationContext}\n\nUSER: ${refinementInstruction}`;

        const data = await api.generateConceptList({
          companyName: 'Visual Concept Generation',
          marketingContent: fullContent,
          referenceImageUrl,
          promptId: selectedPromptId,
          promptText: promptText,
          quantity: selectedIndices.size,
          temperature,
          literalMetaphorical,
          simpleComplex,
        });

        return { data, selectedIndicesArray, isSelective: true };
      } else {
        // Full refinement - all concepts
        const fullContent = `${conversationContext}\n\nUSER: ${feedbackText}`;

        const data = await api.generateConceptList({
          companyName: 'Visual Concept Generation',
          marketingContent: fullContent,
          referenceImageUrl,
          promptId: selectedPromptId,
          promptText: promptText,
          quantity: generatedConcepts.length,
          temperature,
          literalMetaphorical,
          simpleComplex,
        });

        return { data, selectedIndicesArray: [], isSelective: false };
      }
    },
    onSuccess: (result) => {
      const refinedConcepts = result.data.concepts.map(c => c.concept || (typeof c === 'string' ? c : ''));
      
      // Save current state for undo
      setPreviousState({
        concepts: generatedConcepts,
        history: conversationHistory
      });
      
      // Apply refined concepts
      let newConcepts: string[];
      if (result.isSelective) {
        // Replace only the selected concepts using the original order
        newConcepts = [...generatedConcepts];
        result.selectedIndicesArray.forEach((idx, i) => {
          if (i < refinedConcepts.length) {
            newConcepts[idx] = refinedConcepts[i];
          }
        });
      } else {
        // Replace all concepts
        newConcepts = refinedConcepts;
      }
      
      setGeneratedConcepts(newConcepts);
      
      // Update conversation history with the refinement exchange
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: feedbackText },
        { role: 'assistant', content: refinedConcepts.join('\n') }
      ]);
      
      setFeedbackText('');
      setSelectedIndices(new Set()); // Clear selection after refinement
      
      toast({
        title: 'Concepts Refined',
        description: result.isSelective
          ? `Updated ${result.selectedIndicesArray.length} selected concept${result.selectedIndicesArray.length !== 1 ? 's' : ''}`
          : 'Updated all concepts based on your feedback',
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
      description: `Continue refining or switch to Manual Input to close`,
    });
  };

  const handleUndo = () => {
    if (previousState) {
      setGeneratedConcepts(previousState.concepts);
      setConversationHistory(previousState.history);
      setPreviousState(null);
      toast({
        title: 'Refinement Undone',
        description: 'Reverted to previous concepts',
      });
    }
  };

  const handleStartOver = () => {
    setMode('input');
    setGeneratedConcepts([]);
    setFeedbackText('');
    setConversationHistory([]);
    setPreviousState(null);
  };

  const handleDeleteConcept = (indexToDelete: number) => {
    const deletedConcept = generatedConcepts[indexToDelete];
    const updatedConcepts = generatedConcepts.filter((_, index) => index !== indexToDelete);
    setGeneratedConcepts(updatedConcepts);
    
    // Update selected indices (remove deleted index and adjust others)
    const newSelectedIndices = new Set<number>();
    selectedIndices.forEach(idx => {
      if (idx < indexToDelete) {
        newSelectedIndices.add(idx);
      } else if (idx > indexToDelete) {
        newSelectedIndices.add(idx - 1);
      }
    });
    setSelectedIndices(newSelectedIndices);
    
    // Remove the deleted concept from all assistant messages in conversation history
    // This maintains the alternating structure while ensuring deleted concepts don't reappear
    setConversationHistory(prev => {
      // Guard against empty history
      if (prev.length === 0) return prev;
      
      return prev.map(msg => {
        if (msg.role === 'assistant') {
          // Parse the assistant message into concept lines
          const concepts = msg.content.split('\n').filter(line => line.trim());
          // Remove the deleted concept if it appears
          const filteredConcepts = concepts.filter(concept => concept.trim() !== deletedConcept.trim());
          // Return updated message with filtered concepts
          return {
            ...msg,
            content: filteredConcepts.join('\n')
          };
        }
        return msg;
      });
    });
    
    toast({
      title: 'Concept Removed',
      description: `Concept removed from list`,
    });
  };

  const handleToggleSelect = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const handleRefineSingleConcept = (index: number) => {
    // Select only this concept and open refinement mode
    setSelectedIndices(new Set([index]));
    toast({
      title: 'Concept Selected',
      description: 'Provide feedback to refine this concept',
    });
  };

  const generateMoreMutation = useMutation({
    mutationFn: async () => {
      // Build conversation context with full history
      const conversationContext = conversationHistory.map(msg => 
        `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}: ${msg.content}`
      ).join('\n\n');
      
      // Add the "generate more" instruction
      const generateMoreInstruction = 'Generate 3 additional unique concepts different from the ones above.';
      const fullContent = conversationContext 
        ? `${conversationContext}\n\nUSER: ${generateMoreInstruction}`
        : `${marketingContent}\n\n${userInstruction ? `Additional Instructions: ${userInstruction}\n\n` : ''}${generateMoreInstruction}`;
      
      return api.generateConceptList({
        companyName: 'Visual Concept Generation',
        marketingContent: fullContent,
        referenceImageUrl,
        promptId: selectedPromptId,
        promptText: promptText,
        quantity: 3, // Generate 3 new concepts to add
        temperature,
        literalMetaphorical,
        simpleComplex,
      });
    },
    onSuccess: (data) => {
      const newConcepts = data.concepts.map(c => c.concept || (typeof c === 'string' ? c : ''));
      const allConcepts = [...generatedConcepts, ...newConcepts];
      setGeneratedConcepts(allConcepts);
      
      // Append a new user + assistant exchange to conversation history
      // This preserves the chronological structure for refinements and undo
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: 'Generate 3 additional unique concepts different from the ones above.' },
        { role: 'assistant', content: newConcepts.join('\n') }
      ]);
      
      toast({
        title: 'Concepts Added',
        description: `${newConcepts.length} new concepts added to list`,
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

  if (mode === 'results') {
    return (
      <div className="space-y-4">
        {/* Results Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Generated Concepts</h3>
          <div className="flex gap-2">
            {previousState && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                data-testid="button-undo"
              >
                <Undo className="w-4 h-4 mr-1" />
                Undo
              </Button>
            )}
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
        </div>

        {/* Plain Text Concepts with Checkboxes */}
        <div className="space-y-2 rounded-md border bg-muted/30 p-4">
          {generatedConcepts.map((concept, index) => (
            <div
              key={index}
              className="flex items-start gap-2 group"
              data-testid={`concept-result-${index}`}
            >
              <Checkbox
                checked={selectedIndices.has(index)}
                onCheckedChange={() => handleToggleSelect(index)}
                className="mt-1"
                data-testid={`checkbox-concept-${index}`}
              />
              <div className="text-sm leading-relaxed border-l-2 border-primary/30 pl-3 py-1 flex-1">
                {concept}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRefineSingleConcept(index)}
                data-testid={`button-refine-concept-${index}`}
                title="Refine this concept"
              >
                <Wand2 className="w-3 h-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDeleteConcept(index)}
                data-testid={`button-delete-concept-${index}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Generate More Button */}
        <Button
          type="button"
          variant="outline"
          onClick={() => generateMoreMutation.mutate()}
          disabled={generateMoreMutation.isPending}
          className="w-full"
          data-testid="button-generate-more"
        >
          {generateMoreMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Generate More Concepts
            </>
          )}
        </Button>

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
              {selectedIndices.size > 0 
                ? `Refine ${selectedIndices.size} selected concept${selectedIndices.size !== 1 ? 's' : ''}`
                : 'Refine all concepts (optional)'}
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
            placeholder={selectedIndices.size > 0 
              ? "E.g., 'Make more specific' or 'Add lighting details' - will only update selected concepts"
              : "E.g., 'Make them more abstract' or 'Focus on outdoor scenes' - will update all concepts"}
            className="min-h-20"
            data-testid="textarea-feedback"
          />
          {selectedIndices.size > 0 && (
            <p className="text-xs text-muted-foreground">
              💡 Tip: Refinement will only apply to the {selectedIndices.size} checked concept{selectedIndices.size !== 1 ? 's' : ''}. Uncheck all to refine all concepts.
            </p>
          )}
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
