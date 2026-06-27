import { useEffect, useState } from 'react';
import * as THREE from 'three';

export function useScreenTexture(url: string | null | undefined): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
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
      // Drop the reference so a later reload never renders a disposed texture.
      setTexture(null);
    };
  }, [url]);

  // Derive the returned value instead of syncing it via setState in the effect:
  // when there is no url the texture is always null.
  return url ? texture : null;
}
