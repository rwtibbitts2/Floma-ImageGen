import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Sparkles, 
  Edit3, 
  Trash2,
  Lightbulb,
  Building2,
} from 'lucide-react';
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
import { ConceptList } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import ConceptGeneratorModal from '@/components/ConceptGeneratorModal';

export default function ConceptManagement() {
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [deleteConceptListId, setDeleteConceptListId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  
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
                        • {concept.subject}
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
                      onClick={() => setLocation(`/concepts/${conceptList.id}`)}
                      data-testid={`button-edit-${conceptList.id}`}
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      Open Workspace
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
