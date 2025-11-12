// Helper function to build style description from extracted style data
// Dynamically includes ALL fields from styleData regardless of structure
export function buildStyleDescription(styleData: any): string {
  const parts: string[] = [];
  
  // Helper to format field names nicely (convert underscores to spaces)
  const formatFieldName = (key: string): string => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Helper to recursively process any value into readable text
  const processValue = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    } else if (Array.isArray(value)) {
      // Handle arrays - recursively process each element
      const arrayItems = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return processObject(item);
        } else {
          return processValue(item);
        }
      }).filter(item => item !== '');
      return arrayItems.join(', ');
    } else if (typeof value === 'object') {
      return processObject(value);
    }
    
    return String(value); // Fallback for any other type
  };
  
  // Helper to recursively process nested objects into readable text
  const processObject = (obj: any): string => {
    const objParts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined && value !== '') {
        const fieldName = formatFieldName(key);
        const processedValue = processValue(value);
        if (processedValue) {
          objParts.push(`${fieldName}: ${processedValue}`);
        }
      }
    }
    return objParts.length > 0 ? objParts.join(', ') : '';
  };
  
  // Always start with style_name and description if they exist (most important)
  if (styleData.style_name) {
    parts.push(String(styleData.style_name));
  }
  if (styleData.description) {
    parts.push(String(styleData.description));
  }
  
  // Track which keys we've already processed
  const processedKeys = new Set(['style_name', 'description']);
  
  // Dynamically process ALL remaining fields
  for (const [key, value] of Object.entries(styleData)) {
    if (processedKeys.has(key) || value === null || value === undefined || value === '') {
      continue;
    }
    
    const fieldName = formatFieldName(key);
    const processedValue = processValue(value);
    
    if (processedValue) {
      parts.push(`${fieldName}: ${processedValue}`);
    }
  }
  
  return parts.length > 0 ? parts.join('. ') : 'No style data available';
}

export type ConceptValue = string | number | boolean | null | undefined | Record<string, unknown> | any[];

export type StructuredConcept = {
  visual_concept?: ConceptValue;
  core_graphic?: ConceptValue;
  concept?: ConceptValue;
  [key: string]: ConceptValue | undefined;
};

export type Concept = string | StructuredConcept;

export function conceptToDisplayString(concept: Concept): string {
  if (typeof concept === 'string') {
    return concept;
  }
  
  if (concept === null || concept === undefined) {
    return '';
  }
  
  if (typeof concept === 'object') {
    const conceptObj = concept as StructuredConcept;
    
    if (conceptObj.visual_concept !== undefined && conceptObj.core_graphic !== undefined) {
      const visualConceptStr = valueToString(conceptObj.visual_concept);
      const coreGraphicStr = valueToString(conceptObj.core_graphic);
      return `${visualConceptStr} | ${coreGraphicStr}`;
    }
    
    if (conceptObj.concept !== undefined) {
      return valueToString(conceptObj.concept);
    }
    
    return JSON.stringify(concept);
  }
  
  return String(concept);
}

function valueToString(value: ConceptValue): string {
  if (typeof value === 'string') {
    return value;
  }
  
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    return value.map(v => valueToString(v)).join(', ');
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}
