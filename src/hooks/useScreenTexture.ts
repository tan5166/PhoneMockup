import { useEffect, useState } from 'react';
import * as THREE from 'three';

export function useScreenTexture(url: string | null | undefined): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    const textureLoader = new THREE.TextureLoader();
    const loadedTexture = textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 16;
        tex.needsUpdate = true;
        setTexture(tex);
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

  return texture;
}
