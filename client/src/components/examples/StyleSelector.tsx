import StyleSelector from '../StyleSelector';
import { useState } from 'react';
import { ImageStyle } from '@shared/schema';

export default function StyleSelectorExample() {
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>();

  return (
    <div className="max-w-md">
      <StyleSelector
        selectedStyle={selectedStyle}
        onStyleSelect={(style) => {
          setSelectedStyle(style);
          console.log('Style selected:', style.name);
        }}
        onUploadStyle={() => console.log('Upload style triggered')}
      />
    </div>
  );
}