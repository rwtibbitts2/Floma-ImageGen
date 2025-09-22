import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GeneratedImage } from '@shared/schema';

interface ResultsGalleryProps {
  images: GeneratedImage[];
  onDownload?: (image: GeneratedImage) => void;
  onDownloadAll?: () => void;
  onDelete?: (imageId: string) => void;
}

export default function ResultsGallery({ images, onDownload, onDownloadAll, onDelete }: ResultsGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const completedImages = images.filter(img => img.status === 'completed');
  const failedImages = images.filter(img => img.status === 'failed');

  return (
    <>
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">Generated Images</CardTitle>
            {completedImages.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onDownloadAll}
                data-testid="button-download-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
            )}
          </div>
          <CardDescription>
            View and download your generated images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Summary */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {completedImages.length} completed
            </Badge>
            {failedImages.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {failedImages.length} failed
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {images.length} total
            </Badge>
          </div>

          {/* Image Grid */}
          {completedImages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No images generated yet</p>
              <p className="text-sm">Start a generation to see results here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {completedImages.map((image) => (
                <div key={image.id} className="group relative">
                  <div 
                    className="aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover-elevate"
                    onClick={() => setSelectedImage(image)}
                    data-testid={`image-card-${image.id}`}
                  >
                    <img
                      src={image.imageUrl}
                      alt={image.visualConcept}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay Controls */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownload?.(image);
                          }}
                          data-testid={`button-download-${image.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(image.imageUrl, '_blank');
                          }}
                          data-testid={`button-view-${image.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Image Info */}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {image.visualConcept}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {image.createdAt ? new Date(image.createdAt).toLocaleDateString() : 'Unknown'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0"
                            data-testid={`button-menu-${image.id}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onDownload?.(image)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(image.imageUrl, '_blank')}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open in New Tab
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onDelete?.(image.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Failed Images */}
          {failedImages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-600">Failed Generations</h4>
              <div className="space-y-1">
                {failedImages.map((image) => (
                  <div key={image.id} className="text-xs text-muted-foreground p-2 bg-red-50 dark:bg-red-950/20 rounded">
                    Failed: {image.visualConcept}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Detail Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.visualConcept}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.visualConcept}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Concept:</strong> {selectedImage.visualConcept}
                </div>
                <div className="text-sm">
                  <strong>Full Prompt:</strong> {selectedImage.prompt}
                </div>
                <div className="text-sm">
                  <strong>Generated:</strong> {selectedImage.createdAt ? new Date(selectedImage.createdAt).toLocaleString() : 'Unknown'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => onDownload?.(selectedImage)}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={() => window.open(selectedImage.imageUrl, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}