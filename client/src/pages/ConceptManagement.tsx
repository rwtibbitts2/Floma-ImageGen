import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Plus, 
  Sparkles, 
  Edit3, 
  Trash2,
  Lightbulb,
  Building2,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConceptList } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import ConceptGeneratorModal from '@/components/ConceptGeneratorModal';

export default function ConceptManagement() {
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [editingConceptList, setEditingConceptList] = useState<ConceptList | null>(null);
  const [deleteConceptListId, setDeleteConceptListId] = useState<string | null>(null);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  
  // Edit form state
  const [editedName, setEditedName] = useState('');
  const [editedConcepts, setEditedConcepts] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Fetch concept lists from API
  const { data: conceptLists = [], isLoading, refetch } = useQuery({
    queryKey: ['conceptLists'],
    queryFn: api.getConceptLists
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConceptList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptLists'] });
      toast({
        title: 'Concept List Deleted',
        description: 'The concept list has been successfully deleted.'
      });
      setDeleteConceptListId(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete the concept list. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, name, concepts }: { id: string; name: string; concepts: string[] }) => {
      return api.updateConceptList(id, { name, concepts });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptLists'] });
      toast({
        title: 'Concept List Updated',
        description: 'Your changes have been saved successfully.'
      });
      setEditingConceptList(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update the concept list. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Revise mutation
  const reviseMutation = useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: string }) => {
      return api.reviseConceptList(id, feedback);
    },
    onSuccess: (updatedList) => {
      queryClient.invalidateQueries({ queryKey: ['conceptLists'] });
      setEditedConcepts(updatedList.concepts);
      setIsFeedbackDialogOpen(false);
      setFeedbackText('');
      toast({
        title: 'Concepts Revised',
        description: 'Your concepts have been revised based on your feedback.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revise concepts. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleEdit = (conceptList: ConceptList) => {
    setEditingConceptList(conceptList);
    setEditedName(conceptList.name);
    setEditedConcepts([...conceptList.concepts]);
  };

  const handleSaveEdit = () => {
    if (!editingConceptList) return;
    
    if (!editedName.trim()) {
      toast({
        title: 'Missing Name',
        description: 'Please provide a name for the concept list.',
        variant: 'destructive'
      });
      return;
    }

    updateMutation.mutate({
      id: editingConceptList.id,
      name: editedName,
      concepts: editedConcepts.filter(c => c.trim()),
    });
  };

  const handleConceptChange = (index: number, value: string) => {
    const updated = [...editedConcepts];
    updated[index] = value;
    setEditedConcepts(updated);
  };

  const handleAddConcept = () => {
    setEditedConcepts([...editedConcepts, '']);
  };

  const handleRemoveConcept = (index: number) => {
    setEditedConcepts(editedConcepts.filter((_, i) => i !== index));
  };

  const handleReviseWithFeedback = () => {
    if (!editingConceptList || !feedbackText.trim()) {
      toast({
        title: 'Missing Feedback',
        description: 'Please provide feedback for revision.',
        variant: 'destructive'
      });
      return;
    }

    reviseMutation.mutate({
      id: editingConceptList.id,
      feedback: feedbackText,
    });
  };

  const handleGeneratorSaved = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading concept lists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                asChild
                data-testid="button-back-to-home"
              >
                <Link href="/">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Concept Management</h1>
                <p className="text-muted-foreground">Generate and manage marketing concepts</p>
              </div>
            </div>
            <Button 
              className="gap-2" 
              onClick={() => setIsGeneratorModalOpen(true)}
              data-testid="button-generate-concepts"
            >
              <Sparkles className="w-4 h-4" />
              Generate Concepts
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {conceptLists.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No concept lists yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by generating your first marketing concept list. Provide company details and marketing content, and let AI create compelling concepts for you.
            </p>
            <Button 
              className="gap-2" 
              onClick={() => setIsGeneratorModalOpen(true)}
              data-testid="button-create-first-concepts"
            >
              <Sparkles className="w-4 h-4" />
              Create Your First Concept List
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {conceptLists.map((conceptList) => (
              <Card key={conceptList.id} className="hover-elevate group" data-testid={`card-concept-list-${conceptList.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg" data-testid={`text-list-name-${conceptList.id}`}>
                        {conceptList.name}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" data-testid={`badge-count-${conceptList.id}`}>
                      {conceptList.concepts.length} concepts
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Building2 className="w-3 h-3" />
                    <span data-testid={`text-company-${conceptList.id}`}>{conceptList.companyName}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Preview:</p>
                    {conceptList.concepts.slice(0, 3).map((concept, index) => (
                      <div 
                        key={index} 
                        className="text-sm text-foreground/80 truncate"
                        data-testid={`text-preview-concept-${conceptList.id}-${index}`}
                      >
                        • {concept}
                      </div>
                    ))}
                    {conceptList.concepts.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{conceptList.concepts.length - 3} more
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(conceptList)}
                      data-testid={`button-edit-${conceptList.id}`}
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      View/Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConceptListId(conceptList.id)}
                      data-testid={`button-delete-${conceptList.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Generator Modal */}
      <ConceptGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        onConceptListSaved={handleGeneratorSaved}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingConceptList} onOpenChange={(open) => !open && setEditingConceptList(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Concept List</DialogTitle>
            <DialogDescription>
              Modify your concept list or revise it with AI feedback
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">List Name</Label>
              <Input
                id="edit-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Enter list name"
                data-testid="input-edit-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Company Name (read-only)</Label>
              <Input
                value={editingConceptList?.companyName || ''}
                disabled
                data-testid="input-company-readonly"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Concepts ({editedConcepts.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddConcept}
                  data-testid="button-add-concept-edit"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {editedConcepts.map((concept, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={concept}
                      onChange={(e) => handleConceptChange(index, e.target.value)}
                      placeholder={`Concept ${index + 1}`}
                      data-testid={`input-edit-concept-${index}`}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveConcept(index)}
                      data-testid={`button-remove-concept-edit-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsFeedbackDialogOpen(true)}
              data-testid="button-revise-feedback"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Revise with Feedback
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Concepts with AI</DialogTitle>
            <DialogDescription>
              Provide feedback on how you'd like to revise the concepts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="E.g., Make them more professional, focus on sustainability, add technical details..."
              className="min-h-[120px]"
              data-testid="textarea-feedback"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsFeedbackDialogOpen(false);
                setFeedbackText('');
              }}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviseWithFeedback}
              disabled={reviseMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {reviseMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Revising...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Revise
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConceptListId} onOpenChange={(open) => !open && setDeleteConceptListId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Concept List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this concept list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConceptListId && deleteMutation.mutate(deleteConceptListId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
