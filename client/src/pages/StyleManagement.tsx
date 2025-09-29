import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  Eye,
  Upload,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageStyle } from '@shared/schema';
import * as api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import AIStyleExtractorModal from '@/components/AIStyleExtractorModal';

export default function StyleManagement() {
  const [isExtractorModalOpen, setIsExtractorModalOpen] = useState(false);
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<ImageStyle | null>(null);
  const [manualStyleName, setManualStyleName] = useState('');
  const [manualStylePrompt, setManualStylePrompt] = useState('');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch styles from API
  const { data: styles = [], isLoading, refetch } = useQuery({
    queryKey: ['imageStyles'],
    queryFn: api.getImageStyles
  });

  const handleCreateWithAI = () => {
    setEditingStyle(null);
    setIsExtractorModalOpen(true);
  };

  const handleManualUpload = () => {
    setManualStyleName('');
    setManualStylePrompt('');
    setIsManualUploadOpen(true);
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

  const createManualStyleMutation = useMutation({
    mutationFn: async () => {
      return api.createImageStyle({
        name: manualStyleName,
        stylePrompt: manualStylePrompt,
        description: '',
        isAiExtracted: false,
      });
    },
    onSuccess: () => {
      refetch();
      setIsManualUploadOpen(false);
      setManualStyleName('');
      setManualStylePrompt('');
      toast({
        title: 'Style Created',
        description: 'Your manual style has been successfully created.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create the style. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleSaveManualStyle = () => {
    if (!manualStyleName.trim() || !manualStylePrompt.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both a name and style definition.',
        variant: 'destructive'
      });
      return;
    }
    createManualStyleMutation.mutate();
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2" data-testid="button-create-new-style">
                  <Plus className="w-4 h-4" />
                  Create New Style
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCreateWithAI} data-testid="menuitem-create-with-ai">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create with AI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleManualUpload} data-testid="menuitem-manual-upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Manual Upload
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2" data-testid="button-create-first-style">
                  <Sparkles className="w-4 h-4" />
                  Create Your First Style
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={handleCreateWithAI} data-testid="menuitem-create-first-with-ai">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create with AI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleManualUpload} data-testid="menuitem-create-first-manual">
                  <Upload className="w-4 h-4 mr-2" />
                  Manual Upload
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Manual Style Upload Dialog */}
      <Dialog open={isManualUploadOpen} onOpenChange={setIsManualUploadOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-manual-upload">
          <DialogHeader>
            <DialogTitle>Manual Style Upload</DialogTitle>
            <DialogDescription>
              Create a style by manually entering a name and style definition (text or JSON)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="style-name">Style Name</Label>
              <Input
                id="style-name"
                placeholder="e.g., Watercolor Portrait"
                value={manualStyleName}
                onChange={(e) => setManualStyleName(e.target.value)}
                data-testid="input-manual-style-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="style-prompt">Style Definition</Label>
              <Textarea
                id="style-prompt"
                placeholder={`Enter style description or JSON...

Text example:
'Soft watercolor painting with gentle brushstrokes and pastel colors'

JSON example:
{
  "style": "watercolor",
  "colors": ["pastel"],
  "technique": "soft brushstrokes"
}`}
                value={manualStylePrompt}
                onChange={(e) => setManualStylePrompt(e.target.value)}
                rows={10}
                className="resize-none font-mono text-sm"
                data-testid="textarea-manual-style-prompt"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsManualUploadOpen(false)}
              data-testid="button-cancel-manual-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveManualStyle}
              disabled={createManualStyleMutation.isPending}
              data-testid="button-save-manual-style"
            >
              {createManualStyleMutation.isPending ? 'Creating...' : 'Create Style'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}