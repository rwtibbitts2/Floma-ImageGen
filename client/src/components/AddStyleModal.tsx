import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { createImageStyle, updateImageStyle } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ImageStyle } from '@shared/schema';

interface AddStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStyle?: ImageStyle;
}

interface StyleFormData {
  name: string;
  description: string;
  stylePrompt: string;
}

export default function AddStyleModal({ open, onOpenChange, editingStyle }: AddStyleModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<StyleFormData>({
    name: editingStyle?.name || '',
    description: editingStyle?.description || '',
    stylePrompt: editingStyle?.stylePrompt || ''
  });
  
  const [jsonInput, setJsonInput] = useState('');
  const [useJsonMode, setUseJsonMode] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  const createMutation = useMutation({
    mutationFn: createImageStyle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/styles'] });
      toast({
        title: 'Style Created',
        description: 'New image style has been created successfully.',
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create style. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; style: Partial<StyleFormData> }) => 
      updateImageStyle(data.id, data.style),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/styles'] });
      toast({
        title: 'Style Updated',
        description: 'Image style has been updated successfully.',
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update style. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleClose = () => {
    setFormData({ name: '', description: '', stylePrompt: '' });
    setJsonInput('');
    setUseJsonMode(false);
    setValidationError(undefined);
    onOpenChange(false);
  };

  const validateJsonInput = (value: string) => {
    setJsonInput(value);
    
    try {
      const parsed = JSON.parse(value);
      
      if (typeof parsed !== 'object' || !parsed.name || !parsed.stylePrompt) {
        setValidationError('JSON must include "name" and "stylePrompt" fields');
        return;
      }
      
      setFormData({
        name: parsed.name || '',
        description: parsed.description || '',
        stylePrompt: parsed.stylePrompt || ''
      });
      setValidationError(undefined);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setValidationError('Invalid JSON format');
      } else {
        setValidationError('Invalid JSON structure');
      }
    }
  };

  const handleSubmit = () => {
    if (useJsonMode && validationError) {
      return;
    }

    const dataToSubmit = useJsonMode ? formData : formData;
    
    if (!dataToSubmit.name.trim() || !dataToSubmit.stylePrompt.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and style prompt are required.',
        variant: 'destructive'
      });
      return;
    }

    if (editingStyle) {
      updateMutation.mutate({
        id: editingStyle.id,
        style: dataToSubmit
      });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isValid = useJsonMode ? !validationError && formData.name && formData.stylePrompt : formData.name && formData.stylePrompt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85dvh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0 p-6 border-b">
            <DialogTitle>
              {editingStyle ? 'Edit Style' : 'Add New Style'}
            </DialogTitle>
            <DialogDescription>
              {useJsonMode 
                ? 'Paste a JSON object with name, description, and stylePrompt fields.'
                : 'Create a new image style with custom prompts and settings.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant={useJsonMode ? "outline" : "secondary"}
              size="sm"
              onClick={() => setUseJsonMode(false)}
              data-testid="button-form-mode"
            >
              Form
            </Button>
            <Button
              variant={useJsonMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setUseJsonMode(true)}
              data-testid="button-json-mode"
            >
              JSON
            </Button>
          </div>

          {useJsonMode ? (
            <div className="space-y-2">
              <Label htmlFor="json-input">Style JSON</Label>
              <Textarea
                id="json-input"
                value={jsonInput}
                onChange={(e) => validateJsonInput(e.target.value)}
                placeholder={`{
  "name": "Modern Corporate",
  "description": "Clean professional style",
  "stylePrompt": "modern corporate design, professional, clean lines"
}`}
                className="min-h-24 md:min-h-32 max-h-60 resize-y font-mono text-sm"
                data-testid="textarea-style-json"
              />
              
              {validationError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              ) : jsonInput && isValid ? (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Valid JSON
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Style Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Modern Corporate"
                  data-testid="input-style-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this style"
                  data-testid="input-style-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stylePrompt">Style Prompt</Label>
                <Textarea
                  id="stylePrompt"
                  value={formData.stylePrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, stylePrompt: e.target.value }))}
                  placeholder="professional corporate style, clean modern design, business presentation quality"
                  className="min-h-24 md:min-h-32 max-h-60 resize-y"
                  data-testid="textarea-style-prompt"
                />
              </div>
            </div>
          )}

          {!useJsonMode && isValid && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-md">
              <h4 className="text-sm font-medium">Preview:</h4>
              <div className="text-sm space-y-1">
                <div><strong>Name:</strong> {formData.name}</div>
                {formData.description && <div><strong>Description:</strong> {formData.description}</div>}
                <div><strong>Style Prompt:</strong> {formData.stylePrompt}</div>
              </div>
            </div>
          )}
          </div>

          <DialogFooter className="shrink-0 p-6 border-t bg-background">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isLoading}
              data-testid="button-save-style"
            >
              {isLoading ? 'Saving...' : editingStyle ? 'Update Style' : 'Create Style'}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}