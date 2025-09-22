import GenerationSettingsComponent from '../GenerationSettings';
import { useState } from 'react';
import { GenerationSettings } from '@shared/schema';

export default function GenerationSettingsExample() {
  const [settings, setSettings] = useState<GenerationSettings>({
    quality: 'standard',
    size: '1024x1024',
    style: 'vivid',
    variations: 1,
  });

  return (
    <div className="max-w-md">
      <GenerationSettingsComponent
        settings={settings}
        onSettingsChange={(newSettings) => {
          setSettings(newSettings);
          console.log('Settings updated:', newSettings);
        }}
      />
    </div>
  );
}