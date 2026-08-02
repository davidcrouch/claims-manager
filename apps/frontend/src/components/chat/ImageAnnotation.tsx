'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Annotation {
  label: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

interface ImageAnnotationProps {
  imageUrl: string;
  annotations: Annotation[];
}

export function ImageAnnotation({ imageUrl, annotations }: ImageAnnotationProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative my-2 inline-block max-w-full overflow-hidden rounded-lg border border-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Annotated"
        className="block max-h-[400px] max-w-full"
        style={{ width: 'auto', height: 'auto' }}
      />
      {annotations.map((ann, i) => (
        <div
          key={i}
          className={cn(
            'absolute border-2 transition-colors',
            hoveredIndex === i ? 'border-blue-600 bg-blue-500/10' : 'border-blue-400/70',
          )}
          style={{
            left: `${ann.boundingBox.x * 100}%`,
            top: `${ann.boundingBox.y * 100}%`,
            width: `${ann.boundingBox.width * 100}%`,
            height: `${ann.boundingBox.height * 100}%`,
          }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
            {ann.label} ({Math.round(ann.confidence * 100)}%)
          </span>
        </div>
      ))}

      {annotations.length > 0 && (
        <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
          {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
