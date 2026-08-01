const THUMB_MAX_DIMENSION = 200;

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export async function generateThumbnail(file: File): Promise<string | null> {
  if (!IMAGE_TYPES.has(file.type)) {
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > height) {
            if (width > THUMB_MAX_DIMENSION) {
              height = Math.round(height * (THUMB_MAX_DIMENSION / width));
              width = THUMB_MAX_DIMENSION;
            }
          } else {
            if (height > THUMB_MAX_DIMENSION) {
              width = Math.round(width * (THUMB_MAX_DIMENSION / height));
              height = THUMB_MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };

    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
