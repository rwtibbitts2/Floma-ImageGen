import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Shield, UserPlus, ToggleLeft, ToggleRight, AlertTriangle, Home, Settings, Save } from 'lucide-react';
import { getAllUsers, createUser, toggleUserStatus, updateUserRole, getUserPreferences, updateUserPreferences, type CreateUserRequest, type User, type UserPreferences, type UpdatePreferencesRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'user']).default('user'),
});

const promptSettingsSchema = z.object({
  defaultExtractionPrompt: z.string().min(1, 'Extraction prompt is required'),
  defaultConceptPrompt: z.string().min(1, 'Concept prompt is required'),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type PromptSettingsFormData = z.infer<typeof promptSettingsSchema>;

export default function AdminPanel() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPromptSettings, setShowPromptSettings] = useState(false);

  // Fetch all users
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: getAllUsers,
  });

  // Fetch user preferences for default prompts
  const { data: userPreferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['/api/preferences'],
    queryFn: getUserPreferences,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      toast({
        title: 'User created successfully',
        description: `${data.user.email} has been added to the system`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowCreateForm(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: toggleUserStatus,
    onSuccess: (data) => {
      toast({
        title: 'User status updated',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update user status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'user' }) =>
      updateUserRole(userId, role),
    onSuccess: (data) => {
      toast({
        title: 'User role updated',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update user role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: updateUserPreferences,
    onSuccess: () => {
      toast({
        title: 'Preferences updated',
        description: 'Default prompts have been saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
      setShowPromptSettings(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update preferences',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Form setup
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'user',
    },
  });

  // Prompt settings form setup
  const promptForm = useForm<PromptSettingsFormData>({
    resolver: zodResolver(promptSettingsSchema),
    defaultValues: {
      defaultExtractionPrompt: userPreferences?.defaultExtractionPrompt || 'Analyze this image and extract its visual style characteristics including colors, composition, lighting, textures, and artistic elements. Focus on style attributes that can be replicated in generated images.',
      defaultConceptPrompt: userPreferences?.defaultConceptPrompt || 'Generate 5 creative visual concepts based on the provided style. Each concept should be a brief, imaginative description that would work well for image generation. Format as a simple numbered list.',
    },
  });

  const onSubmit = (data: CreateUserFormData) => {
    createUserMutation.mutate(data);
  };

  const onPromptSettingsSubmit = (data: PromptSettingsFormData) => {
    updatePreferencesMutation.mutate(data);
  };

  const handleToggleStatus = (userId: string) => {
    toggleStatusMutation.mutate(userId);
  };

  const handleRoleChange = (userId: string, newRole: 'admin' | 'user') => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Admin Panel</h1>
          </div>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Admin Panel</h1>
          </div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load users. You may not have admin permissions.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation('/')}
              className="flex items-center gap-2"
              data-testid="button-back-to-home"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2"
              data-testid="button-toggle-create-form"
            >
              <UserPlus className="h-4 w-4" />
              {showCreateForm ? 'Cancel' : 'Create User'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPromptSettings(!showPromptSettings)}
              className="flex items-center gap-2"
              data-testid="button-toggle-prompt-settings"
            >
              <Settings className="h-4 w-4" />
              {showPromptSettings ? 'Cancel' : 'Default Prompts'}
            </Button>
          </div>
        </div>

        {/* Create User Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New User</CardTitle>
              <CardDescription>
                Add a new user account to the system. Only admins can create accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="user@example.com"
                            data-testid="input-create-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter a secure password"
                            data-testid="input-create-password"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Password must be at least 6 characters long.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-create-role">
                              <SelectValue placeholder="Select user role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Users can generate images. Admins can manage users and settings.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={createUserMutation.isPending}
                      data-testid="button-create-user-submit"
                    >
                      {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                      data-testid="button-create-user-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Prompt Settings Form */}
        {showPromptSettings && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Default Extraction Prompts
              </CardTitle>
              <CardDescription>
                Configure the default prompts used for AI style extraction and concept generation. These prompts will be pre-loaded when users extract styles from images.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...promptForm}>
                <form onSubmit={promptForm.handleSubmit(onPromptSettingsSubmit)} className="space-y-6">
                  <FormField
                    control={promptForm.control}
                    name="defaultExtractionPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Style Extraction Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the default prompt for extracting visual styles from images..."
                            className="min-h-32"
                            data-testid="textarea-extraction-prompt"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This prompt instructs the AI how to analyze and extract visual style characteristics from uploaded images.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={promptForm.control}
                    name="defaultConceptPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Concept Generation Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the default prompt for generating visual concepts..."
                            className="min-h-32"
                            data-testid="textarea-concept-prompt"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This prompt instructs the AI how to generate creative visual concepts based on the extracted style.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={updatePreferencesMutation.isPending}
                      className="flex items-center gap-2"
                      data-testid="button-save-prompts"
                    >
                      <Save className="h-4 w-4" />
                      {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Prompts'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPromptSettings(false)}
                      data-testid="button-cancel-prompts"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management ({users.length} users)
            </CardTitle>
            <CardDescription>
              Manage user accounts, roles, and access status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: User) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium" data-testid={`text-email-${user.id}`}>
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole: 'admin' | 'user') =>
                          handleRoleChange(user.id, newRole)
                        }
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-24" data-testid={`select-role-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isActive ? 'default' : 'secondary'}
                        data-testid={`badge-status-${user.id}`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-created-${user.id}`}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell data-testid={`text-last-login-${user.id}`}>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(user.id)}
                        disabled={toggleStatusMutation.isPending || user.id === currentUser?.id}
                        className="flex items-center gap-1"
                        data-testid={`button-toggle-status-${user.id}`}
                        title={user.id === currentUser?.id ? "You cannot deactivate your own account" : ""}
                      >
                        {user.isActive ? (
                          <>
                            <ToggleRight className="h-4 w-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4" />
                            Activate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found. Create the first user to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}