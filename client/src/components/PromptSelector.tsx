import { useQuery } from '@tanstack/react-query';
import { SystemPrompt } from '@shared/schema';
import * as api from '@/lib/api';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PromptSelectorProps {
  category: 'style_extraction' | 'concept_generation';
  selectedPromptId?: string;
  onPromptSelect: (prompt: SystemPrompt) => void;
  label?: string;
  description?: string;
}

export default function PromptSelector({ 
  category, 
  selectedPromptId, 
  onPromptSelect,
  label,
  description
}: PromptSelectorProps) {
  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ['systemPrompts', category],
    queryFn: () => api.getSystemPromptsByCategory(category)
  });

  const defaultPrompt = prompts.find(p => p.isDefault);
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  const categoryLabel = category === 'style_extraction' 
    ? 'Style Extraction Prompt' 
    : 'Concept Generation Prompt';

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>{label || categoryLabel}</Label>
        <div className="h-9 bg-muted rounded-md animate-pulse" />
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{label || categoryLabel}</Label>
        <p className="text-sm text-muted-foreground">
          No prompts available. Please create one in Prompt Management.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`prompt-selector-${category}`}>
        {label || categoryLabel}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Select
        value={selectedPrompt?.id || "custom"}
        onValueChange={(promptId) => {
          if (promptId === "custom") return; // Don't change anything for custom
          const prompt = prompts.find(p => p.id === promptId);
          if (prompt) onPromptSelect(prompt);
        }}
      >
        <SelectTrigger 
          id={`prompt-selector-${category}`}
          data-testid={`select-${category}-prompt`}
        >
          <SelectValue placeholder="Select a prompt template" />
        </SelectTrigger>
        <SelectContent>
          {!selectedPrompt && (
            <SelectItem value="custom" disabled>
              Custom prompt (edited)
            </SelectItem>
          )}
          {prompts.map((prompt) => (
            <SelectItem 
              key={prompt.id} 
              value={prompt.id}
              data-testid={`option-prompt-${prompt.id}`}
            >
              <div className="flex items-center gap-2">
                <span>{prompt.name}</span>
                {prompt.isDefault && (
                  <span className="text-xs text-muted-foreground">(Default)</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedPrompt && selectedPrompt.description && (
        <p className="text-xs text-muted-foreground">
          {selectedPrompt.description}
        </p>
      )}
    </div>
  );
}
