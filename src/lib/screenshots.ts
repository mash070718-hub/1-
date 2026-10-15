export const SCREENSHOT_BUCKET = 'mirror-deck-screenshots';
export const MAX_DECK_SCREENSHOTS = 3;
export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
export interface DeckScreenshot {
  path: string;
  caption: string;
  width: number;
  height: number;
}

export function isScreenshotPath(value: unknown): value is string {
  return typeof value === 'string' && /^mirror-decks\/[a-zA-Z0-9_-]{1,100}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(value);
}

/** Re-encode a real decoded raster image, remove metadata, and keep damage numbers readable. */
export async function prepareScreenshot(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('PNG, JPG 또는 WebP 이미지 파일을 선택해 주세요.');
  }
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('사진 한 장의 원본 크기는 20MB 이하여야 합니다.');
  const source = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = source;
    await image.decode().catch(() => { throw new Error('이미지를 읽지 못했습니다. 다른 스크린샷 파일을 선택해 주세요.'); });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error('이미지 해상도가 너무 큽니다. 4천만 화소 이하의 스크린샷을 선택해 주세요.');
    }
    const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서 이미지를 준비하지 못했습니다. 최신 브라우저로 다시 시도해 주세요.');
    context.fillStyle = '#171410';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.84, 0.74]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.type !== 'image/webp') throw new Error('이미지 변환을 지원하는 최신 브라우저로 다시 시도해 주세요.');
      if (blob.size <= MAX_SCREENSHOT_BYTES) return { blob, width: canvas.width, height: canvas.height };
    }
    throw new Error('사진을 줄여도 저장 용량을 넘습니다. 데미지 결과 부분을 잘라서 다시 선택해 주세요.');
  } finally {
    image.src = '';
    URL.revokeObjectURL(source);
  }
}
