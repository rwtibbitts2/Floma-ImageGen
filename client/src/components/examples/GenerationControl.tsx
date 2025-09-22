import GenerationControl from '../GenerationControl';
import { useState } from 'react';
import { ImageStyle, GenerationSettings } from '@shared/schema';

export default function GenerationControlExample() {
  const [isRunning, setIsRunning] = useState(false);

  // Mock data - todo: remove mock functionality
  const mockStyle: ImageStyle = {
    id: '1',
    name: 'Professional Corporate',
    description: 'Clean, modern corporate style',
    stylePrompt: 'professional corporate style, clean modern design',
    createdAt: new Date(),
  };

  const mockConcepts = [
    "A futuristic cityscape at sunset",
    "A cozy coffee shop interior", 
    "A mountain landscape with hiking trail"
  ];

  const mockSettings: GenerationSettings = {
    quality: 'standard',
    size: '1024x1024',
    style: 'vivid',
    variations: 2,
  };

  return (
    <div className="max-w-md">
      <GenerationControl
        selectedStyle={mockStyle}
        concepts={mockConcepts}
        settings={mockSettings}
        isRunning={isRunning}
        onStartGeneration={(jobName) => {
          setIsRunning(true);
          console.log('Starting generation:', jobName);
          // Simulate completion after 3 seconds
          setTimeout(() => setIsRunning(false), 3000);
        }}
        onSaveProject={(jobName) => console.log('Saving project:', jobName)}
      />
    </div>
  );
}