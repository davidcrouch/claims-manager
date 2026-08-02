'use client';

import { useEffect, useState } from 'react';

/** Object-URL thumbnail for image files; null for other types. */
export function useFileThumbnail(file: File | null): string | null {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setThumbnail(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setThumbnail(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return thumbnail;
}
