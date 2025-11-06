import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import * as api from '@/lib/api';
import type { MediaAdapter } from '@/lib/api';

const mediaAdapterFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  vocabularyAdjustments: z.string().min(1, 'Vocabulary adjustments are required'),
  lightingAdjustments: z.string().min(1, 'Lighting adjustments are required'),
  surfaceAdjustments: z.string().min(1, 'Surface adjustments are required'),
  conceptualAdjustments: z.string().min(1, 'Conceptual adjustments are required'),
  isDefault: z.boolean().default(false),
});

type MediaAdapterFormValues = z.infer<typeof mediaAdapterFormSchema>;

export default function MediaAdaptersManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAdapter, setEditingAdapter] = useState<MediaAdapter | null>(null);
  const [deletingAdapter, setDeletingAdapter] = useState<MediaAdapter | null>(null);

  const { data: adapters = [], isLoading } = useQuery<MediaAdapter[]>({
    queryKey: ['/api/media-adapters'],
  });

  const createForm = useForm<MediaAdapterFormValues>({
    resolver: zodResolver(mediaAdapterFormSchema),
    defaultValues: {
      name: '',
      description: '',
      vocabularyAdjustments: '',
      lightingAdjustments: '',
      surfaceAdjustments: '',
      conceptualAdjustments: '',
      isDefault: false,
    },
  });

  const editForm = useForm<MediaAdapterFormValues>({
    resolver: zodResolver(mediaAdapterFormSchema),
  });

  const createMutation = useMutation({
    mutationFn: api.createMediaAdapter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media-adapters'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: 'Success',
        description: 'Media adapter created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MediaAdapterFormValues }) => 
      api.updateMediaAdapter(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media-adapters'] });
      setEditingAdapter(null);
      toast({
        title: 'Success',
        description: 'Media adapter updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteMediaAdapter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media-adapters'] });
      setDeletingAdapter(null);
      toast({
        title: 'Success',
        description: 'Media adapter deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = (values: MediaAdapterFormValues) => {
    createMutation.mutate(values);
  };

  const handleEdit = (adapter: MediaAdapter) => {
    setEditingAdapter(adapter);
    editForm.reset({
      name: adapter.name ?? '',
      description: adapter.description ?? '',
      vocabularyAdjustments: adapter.vocabularyAdjustments ?? '',
      lightingAdjustments: adapter.lightingAdjustments ?? '',
      surfaceAdjustments: adapter.surfaceAdjustments ?? '',
      conceptualAdjustments: adapter.conceptualAdjustments ?? '',
      isDefault: adapter.isDefault ?? false,
    });
  };

  const handleUpdate = (values: MediaAdapterFormValues) => {
    if (editingAdapter) {
      updateMutation.mutate({ id: editingAdapter.id, data: values });
    }
  };

  const handleDelete = (adapter: MediaAdapter) => {
    if (adapter.isDefault) {
      toast({
        title: 'Cannot Delete',
        description: 'Cannot delete the default media adapter. Set another adapter as default first.',
        variant: 'destructive',
      });
      return;
    }
    setDeletingAdapter(adapter);
  };

  const confirmDelete = () => {
    if (deletingAdapter) {
      deleteMutation.mutate(deletingAdapter.id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading adapters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Adapters</h1>
          <p className="text-muted-foreground mt-1">
            Manage media-specific adjustment specifications for style extraction
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2" data-testid="button-create-adapter">
          <Plus className="w-4 h-4" />
          Create Adapter
        </Button>
      </div>

      <div className="grid gap-4">
        {adapters.map((adapter) => (
          <Card key={adapter.id} data-testid={`card-adapter-${adapter.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{adapter.name}</CardTitle>
                    {adapter.isDefault && (
                      <Badge variant="default" className="gap-1" data-testid={`badge-default-${adapter.id}`}>
                        <Star className="w-3 h-3" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{adapter.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(adapter)}
                    data-testid={`button-edit-${adapter.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(adapter)}
                    disabled={adapter.isDefault ?? false}
                    data-testid={`button-delete-${adapter.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Vocabulary Adjustments</h4>
                <p className="text-sm text-muted-foreground">{adapter.vocabularyAdjustments}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Lighting Adjustments</h4>
                <p className="text-sm text-muted-foreground">{adapter.lightingAdjustments}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Surface Adjustments</h4>
                <p className="text-sm text-muted-foreground">{adapter.surfaceAdjustments}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Conceptual Adjustments</h4>
                <p className="text-sm text-muted-foreground">{adapter.conceptualAdjustments}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Media Adapter</DialogTitle>
            <DialogDescription>
              Define media-specific adjustments for style extraction
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Photography" data-testid="input-name" />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Brief description of this media type"
                        rows={2}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="vocabularyAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vocabulary Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Media-specific terminology and language constraints"
                        rows={3}
                        data-testid="textarea-vocabulary"
                      />
                    </FormControl>
                    <FormDescription>
                      Define terminology and vocabulary specific to this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="lightingAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lighting Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="How light behaves in this medium"
                        rows={3}
                        data-testid="textarea-lighting"
                      />
                    </FormControl>
                    <FormDescription>
                      Describe lighting behavior and characteristics for this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="surfaceAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Material rendering and texture characteristics"
                        rows={3}
                        data-testid="textarea-surface"
                      />
                    </FormControl>
                    <FormDescription>
                      Define surface properties and material handling for this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="conceptualAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conceptual Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Composition rules, concept constraints, and realism level"
                        rows={3}
                        data-testid="textarea-conceptual"
                      />
                    </FormControl>
                    <FormDescription>
                      Specify conceptual and compositional guidelines for this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Default Adapter</FormLabel>
                      <FormDescription>
                        Set this as the default adapter for new style extractions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-default"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  Create Adapter
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAdapter} onOpenChange={(open) => !open && setEditingAdapter(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Media Adapter</DialogTitle>
            <DialogDescription>
              Update media-specific adjustments for style extraction
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Photography" data-testid="input-edit-name" />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Brief description of this media type"
                        rows={2}
                        data-testid="textarea-edit-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="vocabularyAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vocabulary Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Media-specific terminology and language constraints"
                        rows={3}
                        data-testid="textarea-edit-vocabulary"
                      />
                    </FormControl>
                    <FormDescription>
                      Define terminology and vocabulary specific to this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="lightingAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lighting Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="How light behaves in this medium"
                        rows={3}
                        data-testid="textarea-edit-lighting"
                      />
                    </FormControl>
                    <FormDescription>
                      Describe lighting behavior and characteristics for this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="surfaceAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Material rendering and texture characteristics"
                        rows={3}
                        data-testid="textarea-edit-surface"
                      />
                    </FormControl>
                    <FormDescription>
                      Define surface properties and material handling for this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="conceptualAdjustments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conceptual Adjustments</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Composition rules, concept constraints, and realism level"
                        rows={3}
                        data-testid="textarea-edit-conceptual"
                      />
                    </FormControl>
                    <FormDescription>
                      Specify conceptual and compositional guidelines for this media type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Default Adapter</FormLabel>
                      <FormDescription>
                        Set this as the default adapter for new style extractions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-is-default"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAdapter(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  Update Adapter
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingAdapter} onOpenChange={(open) => !open && setDeletingAdapter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Media Adapter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingAdapter?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingAdapter(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
