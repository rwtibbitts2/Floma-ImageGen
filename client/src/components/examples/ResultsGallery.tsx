import ResultsGallery from '../ResultsGallery';
import { GeneratedImage } from '@shared/schema';

export default function ResultsGalleryExample() {
  // Mock generated images - todo: remove mock functionality
  const mockImages: GeneratedImage[] = [
    {
      id: '1',
      jobId: 'job1',
      visualConcept: 'A futuristic cityscape at sunset',
      imageUrl: 'https://picsum.photos/400/400?random=1',
      prompt: 'A futuristic cityscape at sunset, professional corporate style, clean modern design',
      status: 'completed',
      createdAt: new Date(),
    },
    {
      id: '2',
      jobId: 'job1', 
      visualConcept: 'A cozy coffee shop interior',
      imageUrl: 'https://picsum.photos/400/400?random=2',
      prompt: 'A cozy coffee shop interior, professional corporate style, clean modern design',
      status: 'completed',
      createdAt: new Date(),
    },
    {
      id: '3',
      jobId: 'job1',
      visualConcept: 'A mountain landscape with hiking trail',
      imageUrl: 'https://picsum.photos/400/400?random=3',
      prompt: 'A mountain landscape with hiking trail, professional corporate style, clean modern design',
      status: 'completed',
      createdAt: new Date(),
    },
    {
      id: '4',
      jobId: 'job1',
      visualConcept: 'Abstract geometric pattern',
      imageUrl: 'https://picsum.photos/400/400?random=4',
      prompt: 'Abstract geometric pattern, creative artistic style, vibrant colors',
      status: 'completed',
      createdAt: new Date(),
    }
  ];

  return (
    <div className="max-w-4xl">
      <ResultsGallery
        images={mockImages}
        onDownload={(image) => console.log('Download image:', image.visualConcept)}
        onDownloadAll={() => console.log('Download all images')}
        onDelete={(imageId) => console.log('Delete image:', imageId)}
      />
    </div>
  );
}