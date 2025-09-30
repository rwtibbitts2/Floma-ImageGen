import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useRoute, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MessageSquare,
  ChevronDown,
  Save,
  X,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Concept, ConceptList, conceptSchema } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface ConceptCardProps {
  concept: Concept;
  conceptIndex: number;
  listId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

function ConceptCard({ concept, conceptIndex, listId, onUpdate, onDelete }: ConceptCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedConcept, setEditedConcept] = useState<Concept>(concept);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  // Get all field keys from the concept
  const fields = Object.keys(concept);
  const titleField = fields[0] || 'concept';
  const detailFields = fields.slice(1);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const conceptList = await api.getConceptListById(listId);
      const updatedConcepts = [...conceptList.concepts];
      updatedConcepts[conceptIndex] = editedConcept;
      return api.updateConceptList(listId, { concepts: updatedConcepts });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptList', listId] });
      setIsEditing(false);
      toast({
        title: 'Concept Updated',
        description: 'Your concept has been successfully updated.',
      });
      onUpdate();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update concept. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const conceptList = await api.getConceptListById(listId);
      const updatedConcepts = conceptList.concepts.filter((_, i) => i !== conceptIndex);
      return api.updateConceptList(listId, { concepts: updatedConcepts });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptList', listId] });
      toast({
        title: 'Concept Deleted',
        description: 'The concept has been removed from the list.',
      });
      onDelete();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete concept. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    // Validate that all complex fields are valid JSON
    for (const fieldName of fields) {
      const originalValue = concept[fieldName];
      const editedValue = editedConcept[fieldName];
      
      // If original was object/array, ensure edited value is still valid structured data
      if (typeof originalValue === 'object' && originalValue !== null) {
        if (typeof editedValue === 'string') {
          // Try to parse it as JSON
          try {
            JSON.parse(editedValue);
          } catch (e) {
            toast({
              title: 'Invalid JSON',
              description: `Field "${formatFieldName(fieldName)}" contains invalid JSON syntax. Please fix it before saving.`,
              variant: 'destructive',
            });
            return;
          }
        }
      }
    }
    
    updateMutation.mutate();
  };

  const handleCancel = () => {
    setEditedConcept(concept);
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleFieldChange = (fieldName: string, textValue: string) => {
    // Try to parse as JSON if it looks like JSON, otherwise keep as string
    let parsedValue: any = textValue;
    
    // Check if original value was an object/array
    const originalValue = concept[fieldName];
    if (typeof originalValue === 'object' && originalValue !== null) {
      // Try to parse the edited text back to JSON
      try {
        parsedValue = JSON.parse(textValue);
      } catch (e) {
        // If parsing fails, keep as string (user might still be typing)
        parsedValue = textValue;
      }
    }
    
    setEditedConcept({ ...editedConcept, [fieldName]: parsedValue });
  };

  // Helper to render field value based on type
  const renderFieldValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };
  
  // Helper to determine if a field contains a complex value (object/array)
  const isComplexValue = (value: any): boolean => {
    return typeof value === 'object' && value !== null;
  };

  // Helper to format field name for display
  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <>
      <Card className="relative">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
          <div className="flex-1">
            {isEditing ? (
              <Textarea
                data-testid={`input-title-${conceptIndex}`}
                value={renderFieldValue(editedConcept[titleField])}
                onChange={(e) => handleFieldChange(titleField, e.target.value)}
                className="text-lg font-semibold min-h-[2.5rem]"
                rows={1}
              />
            ) : (
              <h3
                className="text-lg font-semibold"
                data-testid={`text-title-${conceptIndex}`}
              >
                {renderFieldValue(concept[titleField])}
              </h3>
            )}
          </div>
          <div className="flex gap-1">
            {isEditing ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  data-testid={`button-save-concept-${conceptIndex}`}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancel}
                  data-testid={`button-cancel-edit-${conceptIndex}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  data-testid={`button-edit-concept-${conceptIndex}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid={`button-delete-concept-${conceptIndex}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details" className="border-none">
              <AccordionTrigger
                className="hover:no-underline py-2"
                data-testid={`button-expand-concept-${conceptIndex}`}
              >
                <span className="text-sm text-muted-foreground">View Details</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {detailFields.map((fieldName) => (
                  <div key={fieldName}>
                    <label className="text-sm font-medium text-muted-foreground">
                      {formatFieldName(fieldName)}
                    </label>
                    {isEditing ? (
                      <Textarea
                        data-testid={`textarea-${fieldName}-${conceptIndex}`}
                        value={renderFieldValue(editedConcept[fieldName])}
                        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                        className="mt-1"
                        rows={3}
                      />
                    ) : (
                      <p
                        className="mt-1 text-sm whitespace-pre-wrap"
                        data-testid={`text-${fieldName}-${conceptIndex}`}
                      >
                        {renderFieldValue(concept[fieldName])}
                      </p>
                    )}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Concept</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this concept? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${conceptIndex}`}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              data-testid={`button-confirm-delete-${conceptIndex}`}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function ConceptWorkspace() {
  const [, params] = useRoute('/concepts/:id');
  const [, setLocation] = useLocation();
  const conceptListId = params?.id || '';

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [reviseFeedbackOpen, setReviseFeedbackOpen] = useState(false);
  const [deleteListOpen, setDeleteListOpen] = useState(false);

  const [editedName, setEditedName] = useState('');
  const [reviseFeedback, setReviseFeedback] = useState('');

  const { toast } = useToast();

  // Fetch concept list
  const { data: conceptList, isLoading } = useQuery({
    queryKey: ['conceptList', conceptListId],
    queryFn: () => api.getConceptListById(conceptListId),
    enabled: !!conceptListId,
  });

  // Update name mutation
  const updateNameMutation = useMutation({
    mutationFn: async () => {
      return api.updateConceptList(conceptListId, { name: editedName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptList', conceptListId] });
      queryClient.invalidateQueries({ queryKey: ['conceptLists'] });
      setEditNameOpen(false);
      toast({
        title: 'Name Updated',
        description: 'The concept list name has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update the list name. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Revise concepts mutation
  const reviseMutation = useMutation({
    mutationFn: async () => {
      return api.reviseConceptList(conceptListId, reviseFeedback);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptList', conceptListId] });
      setReviseFeedbackOpen(false);
      setReviseFeedback('');
      toast({
        title: 'Concepts Revised',
        description: 'Your concepts have been revised based on your feedback.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revise concepts. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete list mutation
  const deleteListMutation = useMutation({
    mutationFn: async () => {
      return api.deleteConceptList(conceptListId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptLists'] });
      toast({
        title: 'List Deleted',
        description: 'The concept list has been deleted successfully.',
      });
      setLocation('/concepts');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete the list. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleEditName = () => {
    if (conceptList) {
      setEditedName(conceptList.name);
      setEditNameOpen(true);
    }
  };

  const handleSaveName = () => {
    if (!editedName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'List name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    updateNameMutation.mutate();
  };

  const handleReviseAll = () => {
    if (!reviseFeedback.trim()) {
      toast({
        title: 'Feedback Required',
        description: 'Please enter feedback for revision.',
        variant: 'destructive',
      });
      return;
    }
    reviseMutation.mutate();
  };

  const handleDeleteList = () => {
    deleteListMutation.mutate();
    setDeleteListOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading concept list...</p>
        </div>
      </div>
    );
  }

  if (!conceptList) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Concept list not found</h3>
          <Link href="/concepts">
            <Button data-testid="button-back-to-concepts">Back to Concepts</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild data-testid="button-back">
              <Link href="/concepts">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-list-name">
                {conceptList.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" data-testid="badge-company-name">
                  {conceptList.companyName}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {conceptList.concepts.length} concepts
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleEditName}
              className="gap-2"
              data-testid="button-edit-name"
            >
              <Pencil className="w-4 h-4" />
              Edit Name
            </Button>
            <Button
              variant="outline"
              onClick={() => setReviseFeedbackOpen(true)}
              className="gap-2"
              data-testid="button-revise-all"
            >
              <MessageSquare className="w-4 h-4" />
              Revise All
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteListOpen(true)}
              className="gap-2"
              data-testid="button-delete-list"
            >
              <Trash2 className="w-4 h-4" />
              Delete List
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {conceptList.concepts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground" data-testid="text-empty-state">
                No concepts in this list yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-7xl mx-auto">
            {conceptList.concepts.map((concept, index) => (
              <ConceptCard
                key={index}
                concept={concept}
                conceptIndex={index}
                listId={conceptListId}
                onUpdate={() => {}}
                onDelete={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent data-testid="dialog-edit-name">
          <DialogHeader>
            <DialogTitle>Edit List Name</DialogTitle>
            <DialogDescription>
              Update the name for this concept list.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Enter list name"
              data-testid="input-list-name"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditNameOpen(false)}
              data-testid="button-cancel-edit-name"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveName}
              disabled={updateNameMutation.isPending}
              data-testid="button-save-name"
            >
              {updateNameMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revise Feedback Dialog */}
      <Dialog open={reviseFeedbackOpen} onOpenChange={setReviseFeedbackOpen}>
        <DialogContent data-testid="dialog-revise-feedback">
          <DialogHeader>
            <DialogTitle>Revise All Concepts</DialogTitle>
            <DialogDescription>
              Provide feedback to revise all concepts in this list.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={reviseFeedback}
              onChange={(e) => setReviseFeedback(e.target.value)}
              placeholder="Enter your feedback for revision..."
              rows={5}
              data-testid="textarea-revise-feedback"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviseFeedbackOpen(false)}
              data-testid="button-cancel-revise"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviseAll}
              disabled={reviseMutation.isPending}
              data-testid="button-submit-revise"
            >
              {reviseMutation.isPending ? 'Revising...' : 'Revise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete List Confirmation */}
      <AlertDialog open={deleteListOpen} onOpenChange={setDeleteListOpen}>
        <AlertDialogContent data-testid="dialog-delete-list">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Concept List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this concept list? This action cannot be
              undone and all concepts will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-list">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              data-testid="button-confirm-delete-list"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
