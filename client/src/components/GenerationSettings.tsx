import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { GenerationSettings } from '@shared/schema';

interface GenerationSettingsProps {
  settings: GenerationSettings;
  onSettingsChange: (settings: GenerationSettings) => void;
}

export default function GenerationSettingsComponent({ settings, onSettingsChange }: GenerationSettingsProps) {
  const updateSetting = <K extends keyof GenerationSettings>(
    key: K, 
    value: GenerationSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Generation Settings</CardTitle>
        <CardDescription>
          Configure image quality, size, and variation settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variations Setting - Always Visible */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Variations per Concept</Label>
            <Badge variant="outline" className="text-xs">
              {settings.variations} variation{settings.variations !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Slider
            value={[settings.variations]}
            onValueChange={([value]) => updateSetting('variations', value)}
            min={1}
            max={4}
            step={1}
            className="w-full"
            data-testid="slider-variations"
          />
          <p className="text-xs text-muted-foreground">
            Generate multiple variations of each concept to choose the best result
          </p>
        </div>

        {/* Advanced Settings Accordion */}
        <Accordion type="single" collapsible className="w-full" data-testid="accordion-advanced-settings">
          <AccordionItem value="advanced-settings">
            <AccordionTrigger className="text-sm font-medium" data-testid="accordion-trigger-advanced">
              Advanced Settings
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* Model Setting */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Model</Label>
                  <Select
                    value={settings.model || 'gpt-image-1'}
                    onValueChange={(value: "dall-e-2" | "dall-e-3" | "gpt-image-1") => updateSetting('model', value)}
                  >
                    <SelectTrigger data-testid="select-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-image-1">
                        GPT Image 1
                        <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
                      </SelectItem>
                      <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                      <SelectItem value="dall-e-2">DALL-E 2 (Lower Cost)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose your preferred AI image generation model for optimal results
                  </p>
                </div>

                {/* Quality Setting */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quality</Label>
                  <Select
                    value={settings.quality}
                    onValueChange={(value: "standard" | "hd") => updateSetting('quality', value)}
                  >
                    <SelectTrigger data-testid="select-quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="hd">HD (Higher Cost)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    HD quality takes longer but produces higher resolution images
                  </p>
                </div>

                {/* Size Setting */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Image Size</Label>
                  <Select
                    value={settings.size}
                    onValueChange={(value: "1024x1024" | "1792x1024" | "1024x1792") => updateSetting('size', value)}
                  >
                    <SelectTrigger data-testid="select-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024x1024">
                        Square (1024×1024)
                        <Badge variant="secondary" className="ml-2 text-xs">Recommended</Badge>
                      </SelectItem>
                      <SelectItem value="1792x1024">Landscape (1792×1024)</SelectItem>
                      <SelectItem value="1024x1792">Portrait (1024×1792)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Transparency Setting */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Transparency Support</Label>
                    <Switch
                      checked={settings.transparency}
                      onCheckedChange={(checked) => updateSetting('transparency', checked)}
                      data-testid="switch-transparency"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enable transparency support for PNG format images
                  </p>
                </div>

                {/* Settings Summary */}
                <div className="p-3 bg-muted/50 rounded-md space-y-2">
                  <h4 className="text-sm font-medium">Configuration Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Model: <span className="font-medium">{(settings.model || 'gpt-image-1').toUpperCase()}</span></div>
                    <div>Quality: <span className="font-medium">{settings.quality}</span></div>
                    <div>Size: <span className="font-medium">{settings.size}</span></div>
                    <div>Transparency: <span className="font-medium">{settings.transparency ? 'Enabled' : 'Disabled'}</span></div>
                    <div>Variations: <span className="font-medium">{settings.variations}</span></div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}