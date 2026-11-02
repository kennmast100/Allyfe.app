import { MAX_VIDEO_SECONDS } from '../domain/rules';

/** Photos are scaled so their longest side is at most this, then saved as JPEG. */
const MAX_DIM = 1280;
const JPEG_QUALITY = 0.72;
/** Videos can't be re-encoded in the browser cheaply yet, so cap their size instead. */
const MAX_VIDEO_BYTES = 6 * 1024 * 1024;

/**
 * Below this sharpness score a photo counts as blurry. The score is the
 * variance of the Laplacian (edge strength) in the sharpest parts of the
 * picture, so a photo of a plain wall with one sharp crack still passes.
 * Calibrated on real test photos: sharp ones scored 149–6,200, a real
 * motion-blurred photo 21–71, and moderately blurred copies mostly 20–100.
 */
export const BLUR_THRESHOLD = 80;

export class MediaError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new MediaError('That photo could not be read. Try another one.'));
    };
    img.src = url;
  });
}

/** Sharpness of an image: mean Laplacian variance of its 3 sharpest tiles, measured at 512 px. */
export function sharpness(source: CanvasImageSource, width: number, height: number): number {
  const scale = Math.min(1, 512 / Math.max(width, height));
  const w = Math.max(16, Math.round(width * scale));
  const h = Math.max(16, Math.round(height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

  const T = 6; // tiles per side
  const sums = new Float64Array(T * T);
  const sq = new Float64Array(T * T);
  const cnt = new Uint32Array(T * T);
  for (let y = 1; y < h - 1; y++) {
    const ty = Math.min(T - 1, Math.floor((y / h) * T));
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = g[i - w] + g[i + w] + g[i - 1] + g[i + 1] - 4 * g[i];
      const t = ty * T + Math.min(T - 1, Math.floor((x / w) * T));
      sums[t] += lap;
      sq[t] += lap * lap;
      cnt[t]++;
    }
  }
  const vars: number[] = [];
  for (let t = 0; t < T * T; t++) if (cnt[t]) vars.push(sq[t] / cnt[t] - (sums[t] / cnt[t]) ** 2);
  vars.sort((a, b) => b - a);
  const top = vars.slice(0, 3);
  return top.reduce((s, v) => s + v, 0) / top.length;
}

/** Checks a photo is sharp, then shrinks and compresses it. Returns a JPEG data URL. */
export async function readPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new MediaError('Choose a photo.');
  const img = await loadImage(file);
  if (sharpness(img, img.width, img.height) < BLUR_THRESHOLD) {
    throw new MediaError('This photo looks blurry. Hold the phone steady in good light and take it again.');
  }
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Accepts a video of up to 20 seconds. Returns a data URL. */
export async function readVideo(file: File): Promise<string> {
  if (!file.type.startsWith('video/')) throw new MediaError('Choose a video.');
  const duration = await new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new MediaError('That video could not be read. Try another one.'));
    };
    v.src = url;
  });
  if (!(duration <= MAX_VIDEO_SECONDS + 0.5)) throw new MediaError(`Videos can be at most ${MAX_VIDEO_SECONDS} seconds. This one is ${Math.round(duration)} seconds.`);
  if (file.size > MAX_VIDEO_BYTES) throw new MediaError('This video file is too large. Record it again at a lower quality (720p).');
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new MediaError('That video could not be read. Try another one.'));
    r.readAsDataURL(file);
  });
}

export const isVideo = (ref: string) => ref.startsWith('data:video/');
