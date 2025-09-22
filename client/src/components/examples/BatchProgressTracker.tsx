import BatchProgressTracker from '../BatchProgressTracker';
import { useState } from 'react';
import { GeneratedImage } from '@shared/schema';

export default function BatchProgressTrackerExample() {
  const [isRunning, setIsRunning] = useState(true);
  const [completedImages, setCompletedImages] = useState(3);

  // Mock generated images - todo: remove mock functionality
  const mockRecentImages: GeneratedImage[] = [
    {
      id: '1',
      jobId: 'job1',
      visualConcept: 'Futuristic cityscape',
      imageUrl: 'https://picsum.photos/200/200?random=1',
      prompt: 'Futuristic cityscape with professional corporate style',
      status: 'completed',
      createdAt: new Date(),
    },
    {
      id: '2', 
      jobId: 'job1',
      visualConcept: 'Coffee shop interior',
      imageUrl: 'https://picsum.photos/200/200?random=2',
      prompt: 'Coffee shop interior with professional corporate style',
      status: 'completed',
      createdAt: new Date(),
    }
  ];

  return (
    <div className="max-w-md">
      <BatchProgressTracker
        totalConcepts={5}
        totalVariations={2}
        completedImages={completedImages}
        failedImages={0}
        currentConcept="A mountain landscape with hiking trail"
        isRunning={isRunning}
        onPause={() => {
          setIsRunning(false);
          console.log('Generation paused');
        }}
        onResume={() => {
          setIsRunning(true);
          console.log('Generation resumed');
        }}
        onStop={() => {
          setIsRunning(false);
          console.log('Generation stopped');
        }}
        recentImages={mockRecentImages}
      />
    </div>
  );
}