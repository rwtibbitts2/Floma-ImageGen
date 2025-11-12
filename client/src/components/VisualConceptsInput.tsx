import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, X, Sparkles, Edit3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { visualConceptsSchema, ImageStyle } from '@shared/schema';
import InlineConceptGenerator from '@/components/InlineConceptGenerator';
import { conceptToDisplayString } from '@shared/utils';

interface VisualConceptsInputProps {
  concepts: string[];
  onConceptsChange: (concepts: string[]) => void;
  onUploadFile?: () => void;
  selectedStyle?: ImageStyle;
}

export default function VisualConceptsInput({ concepts, onConceptsChange, onUploadFile, selectedStyle }: VisualConceptsInputProps) {
  const [mode, setMode] = useState<'manual' | 'generate'>('manual');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(concepts, null, 2));
  const [validationError, setValidationError] = useState<string>();

  // Sync jsonInput with concepts prop when it changes (e.g., when loading a saved session)
  useEffect(() => {
    setJsonInput(JSON.stringify(concepts, null, 2));
    setValidationError(undefined);
  }, [concepts]);

  const validateAndUpdate = (value: string) => {
    setJsonInput(value);
    
    try {
      const parsed = JSON.parse(value);
      const validated = visualConceptsSchema.parse(parsed);
      const conceptStrings = validated.map(conceptToDisplayString);
      onConceptsChange(conceptStrings);
      setValidationError(undefined);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setValidationError('Invalid JSON format');
      } else {
        setValidationError('Must be an array of non-empty strings');
      }
    }
  };

  const deleteConcept = (indexToDelete: number) => {
    const updatedConcepts = concepts.filter((_, index) => index !== indexToDelete);
    onConceptsChange(updatedConcepts);
    setJsonInput(JSON.stringify(updatedConcepts, null, 2));
  };

  const handleConceptsGenerated = (generatedConcepts: any[]) => {
    const conceptStrings = generatedConcepts
      .map(conceptToDisplayString)
      .filter(s => s && s.trim());
    
    if (conceptStrings.length === 0) {
      setValidationError('Generated concepts are empty. Please try again with different instructions.');
      return;
    }
    
    onConceptsChange(conceptStrings);
    setJsonInput(JSON.stringify(conceptStrings, null, 2));
    setValidationError(undefined);
    // Keep the generator open so user can continue refining
  };

  const handleCancelGeneration = () => {
    setMode('manual');
  };

  const isValid = !validationError && concepts.length > 0;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Visual Concepts</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setMode(mode === 'manual' ? 'generate' : 'manual')}
            data-testid="button-toggle-concept-mode"
          >
            {mode === 'manual' ? (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Concepts
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Manual Input
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          {mode === 'manual' 
            ? 'Enter visual concepts as a JSON array. Each concept will generate a separate image.'
            : 'Use AI to generate visual concepts from your marketing content'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'generate' ? (
          <InlineConceptGenerator 
            onConceptsGenerated={handleConceptsGenerated}
            onCancel={handleCancelGeneration}
            selectedStyle={selectedStyle}
          />
        ) : (
          <>
        <div className="space-y-2">
          <Textarea
            value={jsonInput}
            onChange={(e) => validateAndUpdate(e.target.value)}
            placeholder={`[
  "A futuristic cityscape at sunset",
  "A cozy coffee shop interior",
  "A mountain landscape with hiking trail"
]`}
            className="min-h-32 font-mono text-sm"
            data-testid="textarea-concepts"
          />
          
          <div className="flex items-center gap-2">
            {isValid ? (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Valid JSON
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {validationError || 'Enter concepts'}
              </div>
            )}
            
            {concepts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {concepts.length} concept{concepts.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {concepts.length > 0 && !validationError && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Preview:</h4>
            <div className="flex flex-wrap gap-2">
              {concepts.map((concept, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs flex items-center gap-1 pr-1"
                  data-testid={`badge-concept-${index}`}
                >
                  <span>{concept.length > 30 ? `${concept.substring(0, 30)}...` : concept}</span>
                  <button
                    type="button"
                    onClick={() => deleteConcept(index)}
                    className="hover-elevate active-elevate-2 rounded-sm p-0.5 transition-colors"
                    data-testid={`button-delete-concept-${index}`}
                    aria-label="Delete concept"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}