import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Save, AlertCircle, Zap } from 'lucide-react';
import { ImageStyle, GenerationSettings } from '@shared/schema';

interface GenerationSummaryActionProps {
  selectedStyle?: ImageStyle;
  concepts: string[];
  settings: GenerationSettings;
  jobName: string;
  isRunning: boolean;
  onStartGeneration: (jobName: string) => void;
  onSaveProject?: (jobName: string) => void;
}

export default function GenerationSummaryAction({
  selectedStyle,
  concepts,
  settings,
  jobName,
  isRunning,
  onStartGeneration,
  onSaveProject
}: GenerationSummaryActionProps) {
  const totalImages = concepts.length * settings.variations;
  const canGenerate = selectedStyle && concepts.length > 0 && jobName.trim().length > 0;

  const estimatedCost = totalImages * (settings.quality === 'hd' ? 0.08 : 0.04); // Example costs
  const estimatedTime = totalImages * 15; // 15 seconds per image

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Ready to Generate</CardTitle>
        <CardDescription>
          Review your configuration and start the batch generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generation Summary */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <h4 className="text-sm font-medium">Generation Summary</h4>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Style:</span>
              <div className="font-medium">
                {selectedStyle ? selectedStyle.name : 'Not selected'}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Concepts:</span>
              <div className="font-medium">{concepts.length}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Variations each:</span>
              <div className="font-medium">{settings.variations}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Total images:</span>
              <div className="font-medium">{totalImages}</div>
            </div>
          </div>

          {/* Cost and Time Estimates */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <Badge variant="outline" className="text-xs">
              ~${estimatedCost.toFixed(2)} estimated cost
            </Badge>
            <Badge variant="outline" className="text-xs">
              ~{Math.ceil(estimatedTime / 60)}min estimated time
            </Badge>
          </div>
        </div>

        {/* Validation Errors */}
        {!canGenerate && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {!selectedStyle && 'Please select an image style. '}
              {concepts.length === 0 && 'Please add visual concepts. '}
              {jobName.trim().length === 0 && 'Please enter a generation name.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => onStartGeneration(jobName)}
            disabled={!canGenerate || isRunning}
            className="flex-1"
            data-testid="button-start-generation"
          >
            {isRunning ? (
              <>
                <Zap className="w-4 h-4 mr-2 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Generation
              </>
            )}
          </Button>
          
          {onSaveProject && (
            <Button
              variant="outline"
              onClick={() => onSaveProject(jobName)}
              disabled={!canGenerate || isRunning}
              data-testid="button-save-project"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Project
            </Button>
          )}
        </div>

        {/* Generation Tips */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Tip:</strong> Higher variations increase cost but give you more options to choose from.</p>
          <p><strong>Note:</strong> HD quality costs 2x more but produces higher resolution images.</p>
        </div>
      </CardContent>
    </Card>
  );
}