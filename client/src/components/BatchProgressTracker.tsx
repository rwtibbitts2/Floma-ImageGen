import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Pause, Play, Square } from 'lucide-react';
import { GeneratedImage } from '@shared/schema';

interface BatchProgressTrackerProps {
  totalConcepts: number;
  totalVariations: number;
  completedImages: number;
  failedImages: number;
  currentConcept?: string;
  isRunning: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  recentImages?: GeneratedImage[];
}

export default function BatchProgressTracker({
  totalConcepts,
  totalVariations,
  completedImages,
  failedImages,
  currentConcept,
  isRunning,
  onPause,
  onResume,
  onStop,
  recentImages = []
}: BatchProgressTrackerProps) {
  const totalImages = totalConcepts * totalVariations;
  const progress = totalImages > 0 ? (completedImages / totalImages) * 100 : 0;
  const isComplete = completedImages === totalImages;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Generation Progress</CardTitle>
          <div className="flex items-center gap-2">
            {isRunning && !isComplete && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onPause}
                data-testid="button-pause"
              >
                <Pause className="w-4 h-4" />
              </Button>
            )}
            {!isRunning && !isComplete && completedImages > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onResume}
                data-testid="button-resume"
              >
                <Play className="w-4 h-4" />
              </Button>
            )}
            {(isRunning || (!isRunning && !isComplete)) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onStop}
                data-testid="button-stop"
              >
                <Square className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {isComplete 
            ? "Generation completed" 
            : isRunning 
              ? "Generating images..." 
              : "Generation paused"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {completedImages} completed
          </Badge>
          {failedImages > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              {failedImages} failed
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {totalImages - completedImages - failedImages} remaining
          </Badge>
        </div>

        {/* Current Concept */}
        {currentConcept && isRunning && (
          <div className="p-3 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Currently Generating</span>
            </div>
            <p className="text-sm text-muted-foreground">{currentConcept}</p>
          </div>
        )}

        {/* Recent Images Preview */}
        {recentImages.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Results</h4>
            <div className="grid grid-cols-4 gap-2">
              {recentImages.slice(-4).map((image) => (
                <div key={image.id} className="aspect-square bg-muted rounded-md overflow-hidden">
                  <img
                    src={image.imageUrl}
                    alt={image.visualConcept}
                    className="w-full h-full object-cover"
                    data-testid={`image-preview-${image.id}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-md">
          <div className="text-center">
            <div className="text-lg font-semibold">{totalConcepts}</div>
            <div className="text-xs text-muted-foreground">Concepts</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totalVariations}</div>
            <div className="text-xs text-muted-foreground">Per Concept</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totalImages}</div>
            <div className="text-xs text-muted-foreground">Total Images</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}