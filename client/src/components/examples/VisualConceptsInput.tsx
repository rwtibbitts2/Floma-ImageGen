import VisualConceptsInput from '../VisualConceptsInput';
import { useState } from 'react';

export default function VisualConceptsInputExample() {
  const [concepts, setConcepts] = useState<string[]>([
    "A futuristic cityscape at sunset",
    "A cozy coffee shop interior",
    "A mountain landscape with hiking trail"
  ]);

  return (
    <div className="max-w-lg">
      <VisualConceptsInput
        concepts={concepts}
        onConceptsChange={(newConcepts) => {
          setConcepts(newConcepts);
          console.log('Concepts updated:', newConcepts);
        }}
        onUploadFile={() => console.log('Upload JSON file triggered')}
      />
    </div>
  );
}