import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Info } from 'lucide-react';
import { GenerationSettings } from '@shared/schema';

interface GenerationSettingsProps {
  settings: GenerationSettings;
  onSettingsChange: (settings: GenerationSettings) => void;
}

// Model capabilities configuration
const modelCapabilities = {
  'dall-e-2': {
    supportsQuality: false,
    supportedSizes: ['1024x1024'],
    supportsRegeneration: true,
    name: 'DALL-E 2',
    description: 'Lower cost, basic features'
  },
  'dall-e-3': {
    supportsQuality: true,
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportsRegeneration: false,
    name: 'DALL-E 3',
    description: 'High quality, no regeneration'
  },
  'gpt-image-1': {
    supportsQuality: true,
    supportedSizes: ['1024x1024', '1536x1024', '1024x1536'],
    supportsRegeneration: true,
    name: 'GPT Image 1',
    description: 'Full features, highest cost'
  }
} as const;

export default function GenerationSettingsComponent({ settings, onSettingsChange }: GenerationSettingsProps) {
  const currentModel = settings.model || 'gpt-image-1';
  const capabilities = modelCapabilities[currentModel];

  const updateSetting = <K extends keyof GenerationSettings>(
    key: K, 
    value: GenerationSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // Handle model change with capability adjustments
  const handleModelChange = (newModel: "dall-e-2" | "dall-e-3" | "gpt-image-1") => {
    const newCapabilities = modelCapabilities[newModel];
    const newSettings = { ...settings, model: newModel };

    // Adjust size if not supported by new model
    if (!(newCapabilities.supportedSizes as readonly string[]).includes(settings.size)) {
      newSettings.size = newCapabilities.supportedSizes[0] as typeof settings.size;
    }

    // Reset quality to standard if model doesn't support quality
    if (!newCapabilities.supportsQuality) {
      newSettings.quality = 'standard';
    }

    onSettingsChange(newSettings);
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
              <div className="space-y-6 pt-2" onPointerDownCapture={(e) => e.stopPropagation()}>
                {/* Model Setting */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Model</Label>
                  <Select
                    value={currentModel}
                    onValueChange={handleModelChange}
                  >
                    <SelectTrigger data-testid="select-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dall-e-3">
                        <div className="flex flex-col items-start">
                          <span>DALL-E 3</span>
                          <span className="text-xs text-muted-foreground">High quality, no regeneration</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="gpt-image-1">
                        <div className="flex flex-col items-start">
                          <span>GPT Image 1</span>
                          <span className="text-xs text-muted-foreground">Full features, highest cost</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="dall-e-2">
                        <div className="flex flex-col items-start">
                          <span>DALL-E 2</span>
                          <span className="text-xs text-muted-foreground">Lower cost, basic features</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Model capabilities info */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{capabilities.name}</p>
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                          <div>• Quality settings: {capabilities.supportsQuality ? 'Supported' : 'Not supported'}</div>
                          <div>• Image sizes: {capabilities.supportedSizes.length === 1 ? '1024×1024 only' : 'Multiple sizes'}</div>
                          <div>• Regeneration: {capabilities.supportsRegeneration ? 'Supported' : 'Not supported'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quality Setting - Only show for models that support it */}
                {capabilities.supportsQuality && (
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
                )}
                
                {/* Quality not supported notice */}
                {!capabilities.supportsQuality && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Quality</Label>
                    <div className="p-3 bg-muted/50 rounded-md border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        Quality settings are not available for {capabilities.name}. All images use standard quality.
                      </p>
                    </div>
                  </div>
                )}

                {/* Size Setting */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Image Size</Label>
                  <Select
                    value={settings.size}
                    onValueChange={(value: "1024x1024" | "1536x1024" | "1024x1536") => updateSetting('size', value)}
                  >
                    <SelectTrigger data-testid="select-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {capabilities.supportedSizes.includes('1024x1024') && (
                        <SelectItem value="1024x1024">
                          Square (1024×1024)
                          <Badge variant="secondary" className="ml-2 text-xs">Recommended</Badge>
                        </SelectItem>
                      )}
                      {(capabilities.supportedSizes as readonly string[]).includes('1536x1024') && (
                        <SelectItem value="1536x1024">Landscape (1536×1024)</SelectItem>
                      )}
                      {(capabilities.supportedSizes as readonly string[]).includes('1024x1536') && (
                        <SelectItem value="1024x1536">Portrait (1024×1536)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {capabilities.supportedSizes.length === 1 && (
                    <p className="text-xs text-muted-foreground">
                      {capabilities.name} only supports 1024×1024 images
                    </p>
                  )}
                </div>

                {/* Transparency Setting */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Transparent Background</Label>
                    <Switch
                      checked={settings.transparency}
                      onCheckedChange={(checked) => updateSetting('transparency', checked)}
                      data-testid="switch-transparency"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Render only the image subject on a transparent background (PNG format)
                  </p>
                </div>

                {/* Settings Summary */}
                <div className="p-3 bg-muted/50 rounded-md space-y-2">
                  <h4 className="text-sm font-medium">Configuration Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Model: <span className="font-medium">{capabilities.name}</span></div>
                    <div>Quality: <span className="font-medium">
                      {capabilities.supportsQuality ? settings.quality : 'Standard (Fixed)'}
                    </span></div>
                    <div>Size: <span className="font-medium">{settings.size}</span></div>
                    <div>Transparency: <span className="font-medium">{settings.transparency ? 'Enabled' : 'Disabled'}</span></div>
                    <div>Variations: <span className="font-medium">{settings.variations}</span></div>
                    <div className="col-span-2 pt-1 border-t border-muted-foreground/20">
                      Regeneration: <span className="font-medium">
                        {capabilities.supportsRegeneration ? 'Available' : 'Not Available'}
                      </span>
                    </div>
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