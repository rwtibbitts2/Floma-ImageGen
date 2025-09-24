import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Download, X, ZoomIn, Sparkles, Loader2 } from 'lucide-react';
import { GeneratedImage } from '@shared/schema';

interface PersistentImageGalleryProps {
  images: GeneratedImage[];
  onDownload: (image: GeneratedImage) => void;
  onDelete: (imageId: string) => void;
  onRegenerate?: (image: GeneratedImage) => void;
  onImageClick?: (image: GeneratedImage) => void;
  isRegenerating?: boolean;
}

export default function PersistentImageGallery({
  images,
  onDownload,
  onDelete,
  onRegenerate,
  onImageClick,
  isRegenerating
}: PersistentImageGalleryProps) {
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Session Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>Generated images will appear here as you create them</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Session Gallery</span>
            {isRegenerating && (
              <div className="flex items-center gap-1 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-normal">Regenerating...</span>
              </div>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {images.length} image{images.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6">
        {/* Horizontal scrolling container */}
        <ScrollArea className="w-full whitespace-nowrap" data-testid="session-gallery-outer">
          <div className="inline-flex w-max gap-4 pb-2 flex-nowrap" data-testid="session-gallery-inner">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative shrink-0 group"
                onMouseEnter={() => setHoveredImage(image.id)}
                onMouseLeave={() => setHoveredImage(null)}
                data-testid={`image-gallery-${image.id}`}
              >
                {/* Image container */}
                <div className="relative w-48 h-48 rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate">
                  <img
                    src={image.imageUrl}
                    alt={image.visualConcept}
                    className="w-full h-full object-cover"
                    onClick={() => onImageClick?.(image)}
                    loading="lazy"
                  />
                  
                  {/* Overlay actions */}
                  {hoveredImage === image.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageClick?.(image);
                        }}
                        data-testid={`button-zoom-${image.id}`}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      {onRegenerate && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRegenerate(image);
                          }}
                          data-testid={`button-regenerate-${image.id}`}
                          title="Regenerate with modifications"
                        >
                          <Sparkles className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(image);
                        }}
                        data-testid={`button-download-${image.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(image.id);
                        }}
                        data-testid={`button-delete-${image.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Image info */}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground line-clamp-2 max-w-48">
                    {image.visualConcept}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {image.createdAt ? new Date(image.createdAt).toLocaleTimeString() : 'Just now'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        
        {/* Gallery actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {images.length} image{images.length !== 1 ? 's' : ''} in this session
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                images.forEach(image => onDownload(image));
              }}
              disabled={images.length === 0}
              data-testid="button-download-all-session"
            >
              <Download className="w-4 h-4 mr-2" />
              Download All ({images.length})
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}