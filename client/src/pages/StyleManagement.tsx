import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Plus, 
  Sparkles, 
  Image as ImageIcon, 
  Edit3, 
  Trash2,
  Eye
} from 'lucide-react';
import { ImageStyle } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import AIStyleExtractorModal from '@/components/AIStyleExtractorModal';

export default function StyleManagement() {
  const [isExtractorModalOpen, setIsExtractorModalOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<ImageStyle | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch styles from API
  const { data: styles = [], isLoading, refetch } = useQuery({
    queryKey: ['imageStyles'],
    queryFn: api.getImageStyles
  });

  const handleCreateNewStyle = () => {
    setEditingStyle(null);
    setIsExtractorModalOpen(true);
  };

  const handleEditStyle = (style: ImageStyle) => {
    if (style.isAiExtracted) {
      // Navigate to workspace for AI-extracted styles
      setLocation(`/workspace?id=${style.id}`);
    } else {
      // Use modal for manually created styles
      setEditingStyle(style);
      setIsExtractorModalOpen(true);
    }
  };

  const handleDeleteStyle = async (styleId: string) => {
    try {
      await api.deleteImageStyle(styleId);
      await refetch();
      toast({
        title: 'Style Deleted',
        description: 'The style has been successfully deleted.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete the style. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleStyleSaved = () => {
    refetch();
    setIsExtractorModalOpen(false);
    toast({
      title: 'Style Saved',
      description: 'Your style has been successfully saved and is ready to use.'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading styles...</p>
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
                data-testid="button-back-to-generator"
              >
                <Link href="/">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Style Management</h1>
                <p className="text-muted-foreground">Create and manage your image generation styles</p>
              </div>
            </div>
            <Button
              onClick={handleCreateNewStyle}
              className="gap-2"
              data-testid="button-create-new-style"
            >
              <Plus className="w-4 h-4" />
              Create New Style
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {styles.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No styles created yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by creating your first style. Upload a reference image and let AI extract the visual style for you.
            </p>
            <Button
              onClick={handleCreateNewStyle}
              className="gap-2"
              data-testid="button-create-first-style"
            >
              <Sparkles className="w-4 h-4" />
              Create Your First Style
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {styles.map((style) => (
              <Card key={style.id} className="hover-elevate group" data-testid={`card-style-${style.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{style.name}</CardTitle>
                      {style.isAiExtracted && (
                        <Badge variant="secondary" className="text-xs" data-testid="badge-ai-extracted">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI
                        </Badge>
                      )}
                    </div>
                  </div>
                  {style.description && (
                    <CardDescription>{style.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Reference Image Preview */}
                  {style.referenceImageUrl && (
                    <div className="aspect-video rounded-md overflow-hidden bg-muted">
                      <img
                        src={style.referenceImageUrl}
                        alt={`Reference for ${style.name}`}
                        className="w-full h-full object-cover"
                        data-testid={`img-reference-${style.id}`}
                      />
                    </div>
                  )}

                  {/* Preview Image */}
                  {style.previewImageUrl && (
                    <div className="aspect-square rounded-md overflow-hidden bg-muted">
                      <img
                        src={style.previewImageUrl}
                        alt={`Preview of ${style.name} style`}
                        className="w-full h-full object-cover"
                        data-testid={`img-preview-${style.id}`}
                      />
                    </div>
                  )}

                  {/* Style Prompt Preview */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Style Prompt</p>
                    <p className="text-sm line-clamp-3" data-testid={`text-style-prompt-${style.id}`}>
                      {style.stylePrompt}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditStyle(style)}
                      className="flex-1 gap-1"
                      data-testid={`button-edit-${style.id}`}
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-1 gap-1"
                      data-testid={`button-use-${style.id}`}
                    >
                      <Link href={`/?styleId=${style.id}`}>
                        <Eye className="w-3 h-3" />
                        Use
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteStyle(style.id)}
                      className="gap-1 text-destructive hover:text-destructive"
                      data-testid={`button-delete-${style.id}`}
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

      {/* AI Style Extractor Modal */}
      <AIStyleExtractorModal
        isOpen={isExtractorModalOpen}
        onClose={() => setIsExtractorModalOpen(false)}
        onStyleSaved={handleStyleSaved}
        editingStyle={editingStyle}
      />
    </div>
  );
}