import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, Plus, Edit, Check, Home, AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

type PromptType = 
  | 'style_extraction_instructions'
  | 'style_extraction_schema'
  | 'composition_extraction_instructions'
  | 'composition_extraction_schema'
  | 'concept_extraction_instructions'
  | 'concept_extraction_schema'
  | 'concept_output_schema'
  | 'intelligent_refine';

interface SystemPrompt {
  id: string;
  name: string;
  description: string | null;
  promptText: string;
  promptType: PromptType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const systemPromptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  promptText: z.string().min(1, 'Prompt text is required'),
  promptType: z.enum([
    'style_extraction_instructions',
    'style_extraction_schema',
    'composition_extraction_instructions',
    'composition_extraction_schema',
    'concept_extraction_instructions',
    'concept_extraction_schema',
    'concept_output_schema',
    'intelligent_refine',
  ]),
});

type SystemPromptFormData = z.infer<typeof systemPromptSchema>;

const promptTypeLabels: Record<PromptType, string> = {
  style_extraction_instructions: 'Style Extraction',
  style_extraction_schema: 'Style Schema',
  composition_extraction_instructions: 'Composition Extraction',
  composition_extraction_schema: 'Composition Schema',
  concept_extraction_instructions: 'Concept Extraction',
  concept_extraction_schema: 'Concept Schema',
  concept_output_schema: 'Concept Output Schema',
  intelligent_refine: 'Intelligent Refine',
};

const promptTypeDescriptions: Record<PromptType, string> = {
  style_extraction_instructions: 'Instructions for extracting visual style from reference images',
  style_extraction_schema: 'JSON schema for style extraction responses',
  composition_extraction_instructions: 'Instructions for extracting compositional architecture',
  composition_extraction_schema: 'JSON schema for composition extraction responses',
  concept_extraction_instructions: 'Instructions for extracting conceptual design language',
  concept_extraction_schema: 'JSON schema for concept extraction responses',
  concept_output_schema: 'JSON schema defining the structure of generated concept outputs (visual_concept + core_graphic)',
  intelligent_refine: 'Instructions for AI-powered refinement comparing reference and preview images to generate improved prompts',
};

export default function SystemPromptsManagement() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState<PromptType>('composition_extraction_instructions');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);

  // Fetch all system prompts
  const { data: allPrompts = [], isLoading, error } = useQuery<SystemPrompt[]>({
    queryKey: ['/api/system-prompts'],
  });

  // Filter prompts by selected type
  const filteredPrompts = allPrompts.filter((p) => p.promptType === selectedTab);

  // Create prompt mutation
  const createMutation = useMutation({
    mutationFn: async (data: SystemPromptFormData) => {
      return await apiRequest('POST', '/api/system-prompts', data);
    },
    onSuccess: () => {
      toast({
        title: 'Prompt created',
        description: 'System prompt has been created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
      setShowCreateDialog(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create prompt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update prompt mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SystemPromptFormData> }) => {
      return await apiRequest('PUT', `/api/system-prompts/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Prompt updated',
        description: 'System prompt has been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
      setShowEditDialog(false);
      setEditingPrompt(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update prompt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Activate prompt mutation
  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PUT', `/api/system-prompts/${id}/activate`);
    },
    onSuccess: () => {
      toast({
        title: 'Prompt activated',
        description: 'This prompt is now active',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to activate prompt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete prompt mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/system-prompts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: 'Prompt deleted',
        description: 'System prompt has been deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete prompt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create form
  const createForm = useForm<SystemPromptFormData>({
    resolver: zodResolver(systemPromptSchema),
    defaultValues: {
      name: '',
      description: '',
      promptText: '',
      promptType: selectedTab,
    },
  });

  // Edit form
  const editForm = useForm<SystemPromptFormData>({
    resolver: zodResolver(systemPromptSchema),
    defaultValues: {
      name: editingPrompt?.name || '',
      description: editingPrompt?.description || '',
      promptText: editingPrompt?.promptText || '',
      promptType: editingPrompt?.promptType || selectedTab,
    },
  });

  const onCreateSubmit = (data: SystemPromptFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: SystemPromptFormData) => {
    if (!editingPrompt) return;
    updateMutation.mutate({ id: editingPrompt.id, data });
  };

  const handleEdit = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    editForm.reset({
      name: prompt.name,
      description: prompt.description || '',
      promptText: prompt.promptText,
      promptType: prompt.promptType,
    });
    setShowEditDialog(true);
  };

  const handleActivate = (id: string) => {
    activateMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this prompt?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl font-bold">System Prompts Management</h1>
          </div>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading prompts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl font-bold">System Prompts Management</h1>
          </div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load system prompts. You may not have admin permissions.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl font-bold">System Prompts Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation('/')}
              className="flex items-center gap-2"
              data-testid="button-back-to-home"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
            <Button
              onClick={() => {
                createForm.setValue('promptType', selectedTab);
                setShowCreateDialog(true);
              }}
              className="flex items-center gap-2"
              data-testid="button-create-prompt"
            >
              <Plus className="h-4 w-4" />
              Create Prompt
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as PromptType)}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="composition_extraction_instructions" data-testid="tab-composition">
              Composition
            </TabsTrigger>
            <TabsTrigger value="concept_extraction_schema" data-testid="tab-concept">
              Concept
            </TabsTrigger>
            <TabsTrigger value="concept_output_schema" data-testid="tab-output-schema">
              Output Schema
            </TabsTrigger>
            <TabsTrigger value="style_extraction_instructions" data-testid="tab-style">
              Style
            </TabsTrigger>
            <TabsTrigger value="intelligent_refine" data-testid="tab-intelligent-refine">
              Intelligent Refine
            </TabsTrigger>
          </TabsList>

          {(Object.keys(promptTypeLabels) as PromptType[]).map((type) => (
            <TabsContent key={type} value={type}>
              <Card>
                <CardHeader>
                  <CardTitle>{promptTypeLabels[type]}</CardTitle>
                  <CardDescription>{promptTypeDescriptions[type]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPrompts.map((prompt) => (
                        <TableRow key={prompt.id} data-testid={`row-prompt-${prompt.id}`}>
                          <TableCell className="font-medium" data-testid={`text-name-${prompt.id}`}>
                            {prompt.name}
                          </TableCell>
                          <TableCell className="max-w-xs truncate" data-testid={`text-description-${prompt.id}`}>
                            {prompt.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={prompt.isActive ? 'default' : 'secondary'}
                              data-testid={`badge-status-${prompt.id}`}
                            >
                              {prompt.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-updated-${prompt.id}`}>
                            {new Date(prompt.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(prompt)}
                                data-testid={`button-edit-${prompt.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {!prompt.isActive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleActivate(prompt.id)}
                                  data-testid={`button-activate-${prompt.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(prompt.id)}
                                disabled={prompt.isActive}
                                data-testid={`button-delete-${prompt.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredPrompts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No prompts found for this type. Create one to get started.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create System Prompt</DialogTitle>
              <DialogDescription>
                Create a new system prompt for {promptTypeLabels[selectedTab]}.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter prompt name"
                          data-testid="input-create-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brief description of this prompt"
                          data-testid="input-create-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="promptText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt Text</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the system prompt content"
                          className="min-h-64 font-mono text-sm"
                          data-testid="textarea-create-prompt"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The full system prompt text that will be used for {promptTypeLabels[selectedTab]}.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    data-testid="button-create-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-create-submit"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Prompt'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit System Prompt</DialogTitle>
              <DialogDescription>
                Update the system prompt for {editingPrompt?.name}.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter prompt name"
                          data-testid="input-edit-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brief description of this prompt"
                          data-testid="input-edit-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="promptText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt Text</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the system prompt content"
                          className="min-h-64 font-mono text-sm"
                          data-testid="textarea-edit-prompt"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The full system prompt text that will be used for extraction.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false);
                      setEditingPrompt(null);
                    }}
                    data-testid="button-edit-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    data-testid="button-edit-submit"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update Prompt'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
