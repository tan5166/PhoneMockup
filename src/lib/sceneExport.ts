import * as THREE from 'three';

/**
 * Handles to the underlying three.js renderer/scene/camera. Captured from
 * inside an `@react-three/fiber` Canvas so code outside the Canvas can drive an
 * offscreen render (e.g. a high-resolution image export).
 */
export interface SceneHandles {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

/** Inclusive pixel bounding box. */
export interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ExportSceneOptions {
  /** Desired supersample factor relative to the on-screen size. Default 4. */
  scale?: number;
  /** Transparent-trim margin, in display pixels (scaled internally). Default 20. */
  padding?: number;
  /** Alpha value above which a pixel counts as content. Default 10. */
  alphaThreshold?: number;
  /** Download filename. Default 'scene.png'. */
  filename?: string;
}

/**
 * Render `scene` from `camera` into an offscreen target at `requestedScale`×
 * the renderer's current display size, and return it as a top-down 2D canvas.
 *
 * The scale is capped to the GPU's max texture size so allocation never fails.
 * Renderer state (active render target) is always restored, and the temporary
 * GPU render target is disposed before returning.
 */
export function renderSceneToCanvas(
  { gl, scene, camera }: SceneHandles,
  requestedScale: number
): { canvas: HTMLCanvasElement; appliedScale: number } {
  const displayCanvas = gl.domElement;
  const cssWidth = displayCanvas.clientWidth;
  const cssHeight = displayCanvas.clientHeight;

  const maxDim = gl.capabilities.maxTextureSize;
  const appliedScale = Math.min(
    requestedScale,
    maxDim / cssWidth,
    maxDim / cssHeight
  );
  const width = Math.floor(cssWidth * appliedScale);
  const height = Math.floor(cssHeight * appliedScale);

  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace, // match the on-screen sRGB output
    samples: 4, // MSAA for antialiased edges in the offscreen pass
  });

  const pixels = new Uint8Array(width * height * 4);
  try {
    // Aspect ratio is unchanged (both dimensions scale equally), so the camera
    // projection needs no update.
    gl.setRenderTarget(renderTarget);
    gl.clear();
    gl.render(scene, camera);
    gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);
  } finally {
    gl.setRenderTarget(null);
    renderTarget.dispose();
  }

  // WebGL pixels are bottom-up; flip vertically into a top-down RGBA buffer.
  const flipped = new Uint8ClampedArray(width * height * 4);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const srcStart = (height - 1 - y) * rowBytes;
    flipped.set(pixels.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire a 2D context for the export canvas');
  ctx.putImageData(new ImageData(flipped, width, height), 0, 0);

  return { canvas, appliedScale };
}

/**
 * Compute the bounding box of pixels whose alpha exceeds `alphaThreshold`.
 * Returns `null` when the image is fully transparent.
 */
export function getOpaqueBounds(
  imageData: ImageData,
  alphaThreshold = 10
): PixelBounds | null {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        hasContent = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  return hasContent ? { minX, minY, maxX, maxY } : null;
}

/** Grow `bounds` by `padding` on every side, clamped to `[0, width|height]`. */
export function expandBounds(
  bounds: PixelBounds,
  padding: number,
  width: number,
  height: number
): PixelBounds {
  return {
    minX: Math.max(0, bounds.minX - padding),
    minY: Math.max(0, bounds.minY - padding),
    maxX: Math.min(width, bounds.maxX + padding),
    maxY: Math.min(height, bounds.maxY + padding),
  };
}

/** Copy the region described by `bounds` out of `source` into a new canvas. */
export function cropCanvas(
  source: HTMLCanvasElement,
  bounds: PixelBounds
): HTMLCanvasElement {
  const cropWidth = bounds.maxX - bounds.minX;
  const cropHeight = bounds.maxY - bounds.minY;

  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire a 2D context for the cropped canvas');

  ctx.clearRect(0, 0, cropWidth, cropHeight); // keep the background transparent
  ctx.drawImage(
    source,
    bounds.minX, bounds.minY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );
  return canvas;
}

/** Trigger a browser download of `canvas` as a PNG named `filename`. */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png', 1.0);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Render the scene at high resolution, trim the transparent margins, and
 * download the result as a PNG.
 *
 * @returns `true` on success, `false` when the rendered scene was empty.
 */
export function exportSceneAsPng(
  handles: SceneHandles,
  {
    scale = 4,
    padding = 20,
    alphaThreshold = 10,
    filename = 'scene.png',
  }: ExportSceneOptions = {}
): boolean {
  const { canvas, appliedScale } = renderSceneToCanvas(handles, scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to read back the export canvas');

  const bounds = getOpaqueBounds(
    ctx.getImageData(0, 0, canvas.width, canvas.height),
    alphaThreshold
  );
  if (!bounds) return false;

  // Scale the visual padding to match the supersampled resolution.
  const padded = expandBounds(
    bounds,
    Math.round(padding * appliedScale),
    canvas.width,
    canvas.height
  );
  downloadCanvasAsPng(cropCanvas(canvas, padded), filename);
  return true;
}
