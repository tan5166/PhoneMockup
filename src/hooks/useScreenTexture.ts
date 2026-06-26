import { useEffect, useState } from 'react';
import * as THREE from 'three';

interface ScreenTexture {
  texture: THREE.Texture;
  aspectRatio: number; // width / height
}

export function useScreenTexture(url: string | null | undefined): ScreenTexture | null {
  const [result, setResult] = useState<ScreenTexture | null>(null);

  useEffect(() => {
    if (!url) {
      setResult(null);
      return;
    }

    const textureLoader = new THREE.TextureLoader();
    const loadedTexture = textureLoader.load(
      url,
      (tex) => {
        const aspectRatio = tex.image.width / tex.image.height;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 16;
        tex.needsUpdate = true;
        setResult({ texture: tex, aspectRatio });
      },
      undefined,
      (error) => {
        console.error('Error loading texture:', error);
      }
    );

    return () => {
      loadedTexture.dispose();
    };
  }, [url]);

  return result;
}
