import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';
import { ImageStyle } from '@shared/schema';

interface StyleSelectorProps {
  selectedStyle?: ImageStyle;
  onStyleSelect: (style: ImageStyle) => void;
  onUploadStyle?: () => void;
}

// Mock styles for demo - todo: remove mock functionality
const mockStyles: ImageStyle[] = [
  {
    id: '1',
    name: 'Professional Corporate',
    description: 'Clean, modern corporate style for business presentations',
    stylePrompt: 'professional corporate style, clean modern design, business presentation quality, high-end commercial photography',
    createdAt: new Date(),
  },
  {
    id: '2', 
    name: 'Creative Artistic',
    description: 'Bold artistic style with vibrant colors and creative elements',
    stylePrompt: 'creative artistic style, vibrant colors, bold design elements, contemporary art inspiration, dynamic composition',
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Minimalist Clean',
    description: 'Simple, clean minimalist aesthetic with plenty of white space',
    stylePrompt: 'minimalist clean style, simple design, plenty of white space, elegant simplicity, modern minimal aesthetic',
    createdAt: new Date(),
  }
];

export default function StyleSelector({ selectedStyle, onStyleSelect, onUploadStyle }: StyleSelectorProps) {
  const [styles] = useState<ImageStyle[]>(mockStyles);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Image Style</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onUploadStyle}
            data-testid="button-upload-style"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Style
          </Button>
        </div>
        <CardDescription>
          Select a visual style to apply to all generated images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={selectedStyle?.id}
          onValueChange={(styleId) => {
            const style = styles.find(s => s.id === styleId);
            if (style) onStyleSelect(style);
          }}
        >
          <SelectTrigger data-testid="select-style">
            <SelectValue placeholder="Choose a style..." />
          </SelectTrigger>
          <SelectContent>
            {styles.map((style) => (
              <SelectItem key={style.id} value={style.id}>
                {style.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedStyle && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{selectedStyle.name}</h4>
              <Badge variant="secondary" className="text-xs">Selected</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedStyle.description}
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Style Prompt:</strong> {selectedStyle.stylePrompt}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}