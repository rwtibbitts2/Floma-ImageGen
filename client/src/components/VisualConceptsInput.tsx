import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { visualConceptsSchema } from '@shared/schema';

interface VisualConceptsInputProps {
  concepts: string[];
  onConceptsChange: (concepts: string[]) => void;
  onUploadFile?: () => void;
}

export default function VisualConceptsInput({ concepts, onConceptsChange, onUploadFile }: VisualConceptsInputProps) {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(concepts, null, 2));
  const [validationError, setValidationError] = useState<string>();

  const validateAndUpdate = (value: string) => {
    setJsonInput(value);
    
    try {
      const parsed = JSON.parse(value);
      const validated = visualConceptsSchema.parse(parsed);
      onConceptsChange(validated);
      setValidationError(undefined);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setValidationError('Invalid JSON format');
      } else {
        setValidationError('Must be an array of non-empty strings');
      }
    }
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
            onClick={onUploadFile}
            data-testid="button-upload-concepts"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload JSON
          </Button>
        </div>
        <CardDescription>
          Enter visual concepts as a JSON array. Each concept will generate a separate image.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                <Badge key={index} variant="outline" className="text-xs">
                  {concept.length > 30 ? `${concept.substring(0, 30)}...` : concept}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}