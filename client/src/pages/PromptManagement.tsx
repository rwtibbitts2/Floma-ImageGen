import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, 
  Plus, 
  Edit3, 
  Trash2,
  FileText
} from 'lucide-react';
import { SystemPrompt } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function PromptManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [activeTab, setActiveTab] = useState<'style_extraction' | 'concept_generation'>('style_extraction');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promptText: '',
    isDefault: false
  });

  const { data: allPrompts = [], isLoading, refetch } = useQuery({
    queryKey: ['systemPrompts'],
    queryFn: api.getAllSystemPrompts
  });

  const styleExtractionPrompts = allPrompts.filter(p => p.category === 'style_extraction');
  const conceptGenerationPrompts = allPrompts.filter(p => p.category === 'concept_generation');

  const createMutation = useMutation({
    mutationFn: api.createSystemPrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemPrompts'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: 'Prompt Created',
        description: 'The prompt has been successfully created.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create the prompt. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSystemPrompt(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemPrompts'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: 'Prompt Updated',
        description: 'The prompt has been successfully updated.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update the prompt. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSystemPrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemPrompts'] });
      toast({
        title: 'Prompt Deleted',
        description: 'The prompt has been successfully deleted.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete the prompt. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      promptText: '',
      isDefault: false
    });
    setEditingPrompt(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      description: prompt.description || '',
      promptText: prompt.promptText,
      isDefault: prompt.isDefault || false
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (promptId: string) => {
    if (confirm('Are you sure you want to delete this prompt?')) {
      deleteMutation.mutate(promptId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.promptText) {
      toast({
        title: 'Validation Error',
        description: 'Name and prompt text are required.',
        variant: 'destructive'
      });
      return;
    }

    if (editingPrompt) {
      updateMutation.mutate({
        id: editingPrompt.id,
        data: formData
      });
    } else {
      createMutation.mutate({
        ...formData,
        category: activeTab
      });
    }
  };

  const renderPromptsList = (prompts: SystemPrompt[]) => {
    if (prompts.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No prompts created yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first prompt to get started
          </p>
          <Button onClick={handleCreate} data-testid="button-create-first-prompt">
            <Plus className="w-4 h-4 mr-2" />
            Create Prompt
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts.map((prompt) => (
          <Card key={prompt.id} data-testid={`card-prompt-${prompt.id}`}>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg line-clamp-1">{prompt.name}</CardTitle>
                {prompt.isDefault && (
                  <Badge variant="secondary" data-testid={`badge-default-${prompt.id}`}>
                    Default
                  </Badge>
                )}
              </div>
              {prompt.description && (
                <CardDescription className="line-clamp-2">
                  {prompt.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {prompt.promptText}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(prompt)}
                  data-testid={`button-edit-${prompt.id}`}
                >
                  <Edit3 className="w-3 h-3 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDelete(prompt.id)}
                  data-testid={`button-delete-${prompt.id}`}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                asChild
                data-testid="button-back"
              >
                <Link href="/">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Prompt Management</h1>
                <p className="text-muted-foreground">Manage system prompts for style extraction and concept generation</p>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              className="gap-2"
              data-testid="button-create-prompt"
            >
              <Plus className="w-4 h-4" />
              Create Prompt
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
          <TabsList className="mb-6">
            <TabsTrigger value="style_extraction" data-testid="tab-style-extraction">
              Style Extraction
            </TabsTrigger>
            <TabsTrigger value="concept_generation" data-testid="tab-concept-generation">
              Concept Generation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="style_extraction">
            {renderPromptsList(styleExtractionPrompts)}
          </TabsContent>

          <TabsContent value="concept_generation">
            {renderPromptsList(conceptGenerationPrompts)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
            </DialogTitle>
            <DialogDescription>
              {editingPrompt ? 'Update the prompt details below.' : `Create a new prompt for ${activeTab === 'style_extraction' ? 'style extraction' : 'concept generation'}.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Advanced Style Analyzer"
                required
                data-testid="input-prompt-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of what this prompt does"
                rows={2}
                data-testid="textarea-prompt-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promptText">Prompt Text *</Label>
              <Textarea
                id="promptText"
                value={formData.promptText}
                onChange={(e) => setFormData({ ...formData, promptText: e.target.value })}
                placeholder="Enter the full prompt text..."
                rows={10}
                required
                data-testid="textarea-prompt-text"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                data-testid="switch-is-default"
              />
              <Label htmlFor="isDefault">Set as default prompt</Label>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingPrompt ? 'Update' : 'Create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
