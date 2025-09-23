import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { createProjectSession, clearTemporarySessions, getTemporarySessionsForUser, migrateGenerationJobsToSession } from '@/lib/api';
import { ImageStyle, GenerationSettings } from '@shared/schema';

interface SaveSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveComplete: (sessionId: string) => void;
  selectedStyle?: ImageStyle;
  concepts: string[];
  settings: GenerationSettings;
}

export default function SaveSessionModal({ 
  open, 
  onOpenChange, 
  onSaveComplete,
  selectedStyle,
  concepts,
  settings 
}: SaveSessionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState('');

  const saveMutation = useMutation({
    mutationFn: async (customName?: string) => {
      // Generate display name: custom name or timestamp
      const displayName = customName || new Date().toLocaleString();
      
      const sessionData = {
        name: customName || undefined,
        displayName,
        styleId: selectedStyle?.id,
        visualConcepts: concepts,
        settings,
        isTemporary: false,
        hasUnsavedChanges: false
      };

      console.log('Attempting to save session:', sessionData);
      console.log('Selected style:', selectedStyle);
      console.log('Concepts:', concepts);
      console.log('Settings:', settings);

      try {
        const session = await createProjectSession(sessionData);
        console.log('Session created successfully:', session);
        
        // Get temporary sessions and migrate their generation jobs to the new session
        try {
          const tempSessions = await getTemporarySessionsForUser();
          console.log('Found temporary sessions:', tempSessions);
          
          if (tempSessions.length > 0) {
            // Migrate jobs from each temporary session to the new saved session
            let totalMigrated = 0;
            for (const tempSession of tempSessions) {
              const migrationResult = await migrateGenerationJobsToSession(session.id, tempSession.id);
              totalMigrated += migrationResult.migratedCount;
              console.log(`Migrated ${migrationResult.migratedCount} jobs from temp session ${tempSession.id} to ${session.id}`);
            }
            
            // Clear temporary sessions after successful migration
            await clearTemporarySessions();
            console.log(`Migration complete: ${totalMigrated} jobs migrated, temporary sessions cleared`);
            
            if (totalMigrated > 0) {
              // Show success feedback to user
              console.log(`Successfully migrated ${totalMigrated} generated images to saved session`);
            }
          } else {
            console.log('No temporary sessions found to migrate');
          }
        } catch (migrationError) {
          console.warn('Failed to migrate jobs or clear temporary sessions (non-critical):', migrationError);
        }
        
        return session;
      } catch (error) {
        console.error('Detailed save error:', error);
        console.error('Error name:', error?.name);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        
        // Re-throw to trigger the onError handler
        throw error;
      }
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['projectSessions'] });
      toast({
        title: 'Project Saved',
        description: `Session saved as "${session.displayName}"`,
      });
      onSaveComplete(session.id);
      handleClose();
    },
    onError: (error) => {
      toast({
        title: 'Save Failed',
        description: 'Failed to save project session. Please try again.',
        variant: 'destructive'
      });
      console.error('Save error:', error);
    }
  });

  const handleClose = () => {
    setProjectName('');
    onOpenChange(false);
  };

  const handleSave = () => {
    if (!concepts.length) {
      toast({
        title: 'Nothing to Save',
        description: 'Please add visual concepts before saving.',
        variant: 'destructive'
      });
      return;
    }

    saveMutation.mutate(projectName.trim() || undefined);
  };

  const isValid = concepts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Project Session</DialogTitle>
          <DialogDescription>
            Save your current generation setup to load later. 
            Leave name blank to use date/time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name (Optional)</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Marketing Campaign Q1"
              data-testid="input-project-name"
            />
            <p className="text-sm text-muted-foreground">
              If blank, will be saved as: {new Date().toLocaleString()}
            </p>
          </div>

          {/* Preview current session */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-md">
            <h4 className="text-sm font-medium">Session Preview:</h4>
            <div className="text-sm space-y-1">
              <div><strong>Style:</strong> {selectedStyle?.name || 'None selected'}</div>
              <div><strong>Concepts:</strong> {concepts.length} concept{concepts.length !== 1 ? 's' : ''}</div>
              <div><strong>Settings:</strong> {settings.quality} quality, {settings.variations} variation{settings.variations !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={saveMutation.isPending}
            data-testid="button-cancel-save"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || saveMutation.isPending}
            data-testid="button-confirm-save"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}