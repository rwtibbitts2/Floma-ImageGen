import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GenerationJobNameProps {
  jobName: string;
  onJobNameChange: (name: string) => void;
  disabled?: boolean;
}

export default function GenerationJobName({ jobName, onJobNameChange, disabled }: GenerationJobNameProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Generation Name</CardTitle>
        <CardDescription>
          Enter a name for this batch generation project
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="job-name" className="text-sm font-medium">
            Project Name
          </Label>
          <Input
            id="job-name"
            value={jobName}
            onChange={(e) => onJobNameChange(e.target.value)}
            placeholder="e.g., Marketing Campaign Q1 2024"
            disabled={disabled}
            data-testid="input-job-name"
          />
        </div>
      </CardContent>
    </Card>
  );
}