import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Moon, Sun } from 'lucide-react';
import { 
  Plus, 
  Calendar, 
  Palette, 
  ImageIcon, 
  Settings,
  Trash2,
  FolderOpen,
  AlertTriangle,
  LogOut
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getAllProjectSessions, deleteProjectSession } from '@/lib/api';
import { ProjectSession } from '@shared/schema';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// ThemeToggle component
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark', !isDark);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logout, user } = useAuth();

  // Fetch all saved sessions
  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['projectSessions'],
    queryFn: getAllProjectSessions,
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProjectSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectSessions'] });
      toast({
        title: 'Session Deleted',
        description: 'Project session has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete session. Please try again.',
        variant: 'destructive'
      });
      console.error('Delete error:', error);
    }
  });

  const handleOpenSession = (session: ProjectSession) => {
    // Navigate to generator with session data
    setLocation(`/generate?session=${session.id}`);
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteMutation.mutate(sessionId);
  };

  const handleNewSession = () => {
    setLocation('/generate');
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
    } catch (error) {
      toast({
        title: 'Logout failed',
        description: 'There was an error logging you out.',
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter out temporary sessions for the main display
  const savedSessions = sessions.filter((s: ProjectSession) => !s.isTemporary);
  const temporarySession = sessions.find((s: ProjectSession) => s.isTemporary);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ImageIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Image Generator</h1>
              <p className="text-sm text-muted-foreground">Enterprise batch image generation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleNewSession}
              data-testid="button-new-generation"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate Images
            </Button>
            <Button 
              variant="outline"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Temporary Session Alert */}
        {temporarySession && (
          <Alert className="mb-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have an unsaved autosave session from {formatDate(temporarySession.updatedAt)}.{' '}
              <Button 
                variant="ghost" 
                className="p-0 h-auto underline"
                onClick={() => handleOpenSession(temporarySession)}
                data-testid="button-restore-autosave"
              >
                Click to restore it
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Saved Sessions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Saved Projects</h3>
            {savedSessions.length > 0 && (
              <p className="text-muted-foreground">
                {savedSessions.length} project{savedSessions.length !== 1 ? 's' : ''} saved
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load saved sessions. Please refresh the page to try again.
              </AlertDescription>
            </Alert>
          ) : savedSessions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h4 className="text-lg font-semibold mb-2">No Saved Projects</h4>
                <p className="text-muted-foreground mb-6">
                  Start by creating your first image generation session
                </p>
                <Button onClick={handleNewSession} data-testid="button-first-generation">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedSessions.map((session: ProjectSession) => (
                <Card key={session.id} className="hover-elevate transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{session.displayName}</span>
                      {session.hasUnsavedChanges && (
                        <Badge variant="secondary" className="ml-2">Unsaved</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar className="w-3 h-3" />
                        {formatDate(session.updatedAt)}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Palette className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Style:</span>
                        <span>{session.styleId ? 'Custom Style' : 'No Style'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Concepts:</span>
                        <span>{session.visualConcepts?.length || 0}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Settings:</span>
                        <span>{session.settings?.quality || 'standard'}, {session.settings?.variations || 1} var</span>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleOpenSession(session)}
                          data-testid={`button-open-${session.id}`}
                        >
                          <FolderOpen className="w-4 h-4 mr-1" />
                          Open
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              data-testid={`button-delete-${session.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Project</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{session.displayName}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteSession(session.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}