import { useRef, useEffect, useState, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { useScreenTexture } from '@/hooks/useScreenTexture';

interface PhoneModelProps {
  screenshotUrl: string | null | undefined;
  isAutoRotating: boolean;
  onLoadProgress?: (progress: number) => void;
  rotationDirection?: 'clockwise' | 'counterclockwise';
  onRotationChange?: (deltaX: number, deltaY: number) => void;
  onZRotationChange?: (deltaZ: number) => void;
  shellColor?: string;
  backPanelColor?: string;
}

export function PhoneModel({
  screenshotUrl,
  isAutoRotating,
  onLoadProgress,
  rotationDirection = 'clockwise',
  onRotationChange,
  onZRotationChange,
  shellColor = '#3a4054',
  backPanelColor = '#414759',
}: PhoneModelProps) {
  const modelRef = useRef<THREE.Group | null>(null);
  const screenTexture = useScreenTexture(screenshotUrl);
  const texture = screenTexture?.texture ?? null;
  const { gl, invalidate } = useThree();
  // Load the phone model using GLTFLoader
  const gltf = useLoader(
    GLTFLoader,
    '/models/iphone17pro-2.glb?v=noisland2',
    (loader) => {
      onLoadProgress?.(0);
      const originalLoad = loader.load.bind(loader);
      loader.load = (url: string, onLoad?: (result: any) => void, _?: (event: ProgressEvent) => void, onError?: (err: unknown) => void) => {
        originalLoad(
          url,
          (result: any) => {
            onLoadProgress?.(1);
            onLoad?.(result);
          },
          (event: ProgressEvent) => {
            if (event.lengthComputable) {
              onLoadProgress?.(event.loaded / event.total);
            }
          },
          onError
        );
      };
    }
  );
  const obj = gltf.scene;
  
  // Create a high-quality environment map
  const envMap = useMemo(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();

    // Create a gradient skybox
    const envScene = new THREE.Scene();
    const gradientTexture = new THREE.DataTexture(
      generateGradientData(),
      256,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    gradientTexture.needsUpdate = true;
    
    const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        gradientMap: { value: gradientTexture },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D gradientMap;
        varying vec3 vWorldPosition;
        void main() {
          vec3 normalizedPos = normalize(vWorldPosition);
          float y = normalizedPos.y * 0.5 + 0.5;
          gl_FragColor = texture2D(gradientMap, vec2(y, 0.5));
        }
      `,
      side: THREE.BackSide,
    });
    
    const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    envScene.add(skyMesh);
    
    const envTexture = pmremGenerator.fromScene(envScene).texture;
    pmremGenerator.dispose();
    envScene.remove(skyMesh);
    
    return envTexture;
  }, [gl]);
  
  // Generate the gradient data
  function generateGradientData() {
    const size = 256;
    const data = new Float32Array(size * 4);
    
    const topColor = new THREE.Color(0.8, 0.9, 1.0);  // Sky blue
    const middleColor = new THREE.Color(0.5, 0.6, 0.7);  // Gray blue
    const bottomColor = new THREE.Color(0.2, 0.2, 0.3);  // Dark blue
    
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      let color;
      
      if (t < 0.5) {
        color = new THREE.Color().lerpColors(bottomColor, middleColor, t * 2);
      } else {
        color = new THREE.Color().lerpColors(middleColor, topColor, (t - 0.5) * 2);
      }
      
      data[i * 4] = color.r;
      data[i * 4 + 1] = color.g;
      data[i * 4 + 2] = color.b;
      data[i * 4 + 3] = 1.0;
    }
    
    return data;
  }
  
  // State management
  const [isDragging, setIsDragging] = useState(false);
  const [previousTouch, setPreviousTouch] = useState({ x: 0, y: 0 });
  const rotationSpeed = 0.003;
  const autoRotationSpeed = 0.01;

  // Preprocess the model and materials
  const processedObj = useMemo(() => {
    if (!obj) return null;

    const clonedObj = obj.clone();

    // The GLB's back (camera) faces +X and its long axis is +Z. Rotate so the
    // screen (model -X) faces +Z toward the camera and the phone stands upright
    // in portrait: model +Z (height) -> world +Y, model +Y (width) -> world -X.
    clonedObj.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    // The base rotation lands the phone front-facing but in landscape; roll it
    // 90° about the viewing axis (world Z) to stand it upright in portrait.
    clonedObj.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    clonedObj.updateMatrixWorld(true);

    // Tint the body/frame meshes with the shell color; tint the back glass
    // (Material.005) with a separate back-panel color; keep the original
    // materials for the lens, screen, glass, logo, etc.
    const shellColorObj = new THREE.Color(shellColor);
    const backPanelColorObj = new THREE.Color(backPanelColor);
    const isShellMesh = (name: string) =>
      /backpanel|basecolor|metalframe|metal|gray|black/.test(name) &&
      !/glass|lens|screen|logo/.test(name);
    // Note: GLTFLoader strips dots from node names, so at runtime it is named
    // "material005" (no dot); the \.? here matches both the dotted and
    // dotless forms.
    const isBackPanelMesh = (name: string) => /material\.?005/.test(name);

    // Keep the model's original materials; only add the environment map to
    // materials that support environment reflections, tint as needed, and
    // enable shadows.
    clonedObj.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name.toLowerCase();
        const tintColor = isShellMesh(name)
          ? shellColorObj
          : isBackPanelMesh(name)
            ? backPanelColorObj
            : null;
        const applyMaterial = (mat: THREE.Material) => {
          if (
            mat instanceof THREE.MeshStandardMaterial ||
            mat instanceof THREE.MeshPhysicalMaterial
          ) {
            mat.envMap = envMap;
            mat.envMapIntensity = 1.0;
            if (tintColor) {
              mat.color.copy(tintColor);
              mat.map = null; // Remove the original texture so the solid color shows
              // Metalness/roughness keep the model's original per-mesh values.
            }
            mat.needsUpdate = true;
          }
        };

        if (Array.isArray(child.material)) {
          child.material = child.material.map((m) => {
            const cloned = m.clone();
            applyMaterial(cloned);
            return cloned;
          });
        } else {
          child.material = child.material.clone();
          applyMaterial(child.material);
        }

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clonedObj;
  }, [obj, envMap, shellColor, backPanelColor]);
  
  useEffect(() => {
    if (!processedObj || !modelRef.current) return;

    const modelGroup = new THREE.Group();
    modelGroup.add(processedObj.clone());

    const box = new THREE.Box3().setFromObject(processedObj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Auto-normalize scale so any model (OBJ mm, GLB meters, etc.) fills the scene correctly
    const TARGET_HEIGHT = 15;
    const autoScale = TARGET_HEIGHT / Math.max(size.x, size.y, size.z);
    const MODEL_SCALE_EFFECTIVE = autoScale;
    modelGroup.scale.setScalar(MODEL_SCALE_EFFECTIVE);

    modelGroup.children[0].position.sub(center);

    // Always fill the dynamic-island cutout in the screen mesh so the hole
    // (left by removing the island geometry from the GLB) never shows through
    // to the back shell — whether a screenshot is uploaded or not.
    modelGroup.traverse((child: THREE.Object3D) => {
      if (
        child instanceof THREE.Mesh &&
        /screen/.test(child.name.toLowerCase()) &&
        !/glass|lens/.test(child.name.toLowerCase())
      ) {
        const geom = child.geometry.clone();
        const pos = geom.attributes.position;
        let xMin = Infinity;
        let yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          if (x < xMin) xMin = x;
          if (y < yMin) yMin = y; if (y > yMax) yMax = y;
          if (z < zMin) zMin = z; if (z > zMax) zMax = z;
        }
        const ySpan = yMax - yMin || 1;
        const zSpan = zMax - zMin || 1;
        const planarUV = (y: number, z: number): [number, number] => [
          (yMax - y) / ySpan,
          (z - zMin) / zSpan,
        ];

        // Always punch a filled quad over the island cutout. When a screenshot
        // is uploaded it shares the screenshot material so the pixels are
        // seamless; otherwise it uses a solid dark tone that blends with the
        // edges of the cutout.
        const yPatch0 = -0.14, yPatch1 = 0.15, zPatch0 = 0.7, zPatch1 = zMax;
        const xPatch = xMin + 0.002;
        const corners: [number, number][] = [
          [yPatch0, zPatch0],
          [yPatch1, zPatch0],
          [yPatch1, zPatch1],
          [yPatch0, zPatch1],
        ];
        const patchPos = new Float32Array(corners.length * 3);
        const patchUV = new Float32Array(corners.length * 2);
        corners.forEach(([y, z], i) => {
          patchPos[i * 3] = xPatch;
          patchPos[i * 3 + 1] = y;
          patchPos[i * 3 + 2] = z;
          const [u, v] = planarUV(y, z);
          patchUV[i * 2] = u;
          patchUV[i * 2 + 1] = v;
        });
        const patchGeom = new THREE.BufferGeometry();
        patchGeom.setAttribute('position', new THREE.BufferAttribute(patchPos, 3));
        patchGeom.setAttribute('uv', new THREE.BufferAttribute(patchUV, 2));
        patchGeom.setIndex([0, 1, 2, 0, 2, 3]);

        if (texture) {
          // Replace the model's built-in screen wallpaper with the uploaded
          // screenshot, mapping it onto the screen geometry via clean planar UVs.
          const uv = new Float32Array(pos.count * 2);
          for (let i = 0; i < pos.count; i++) {
            const [u, v] = planarUV(pos.getY(i), pos.getZ(i));
            uv[i * 2] = u;
            uv[i * 2 + 1] = v;
          }
          geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.flipY = true;
          texture.needsUpdate = true;

          // Unlit + untonemapped so the screen looks like a glowing display.
          const screenMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            toneMapped: false,
            side: THREE.DoubleSide,
          });
          child.material = screenMaterial;

          // Fill the cutout with the same screenshot so pixels are seamless.
          const patchMesh = new THREE.Mesh(patchGeom, screenMaterial);
          child.add(patchMesh);
        } else {
          // No screenshot — fill the cutout with a solid dark colour that
          // matches the shadow of the island, keeping the model's baked screen.
          const patchMaterial = new THREE.MeshBasicMaterial({
            color: 0x111111,
            side: THREE.DoubleSide,
          });
          const patchMesh = new THREE.Mesh(patchGeom, patchMaterial);
          child.add(patchMesh);
        }

        child.geometry = geom;
      }
    });

    // Always update modelRef.current children
    while (modelRef.current.children.length > 0) {
        modelRef.current.remove(modelRef.current.children[0]);
    }
    modelRef.current.add(modelGroup);
    
    invalidate(); 

    const canvas = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      setIsDragging(true);
      setPreviousTouch({
        x: event.clientX,
        y: event.clientY
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging || !onRotationChange || !onZRotationChange) return;

      const deltaX = event.clientY - previousTouch.y;
      const deltaY = event.clientX - previousTouch.x;

      if (event.shiftKey) {
        const deltaZ = deltaY * rotationSpeed * 2;
        onZRotationChange(deltaZ);
        setPreviousTouch({ x: event.clientX, y: previousTouch.y });
      } else {
        onRotationChange(deltaX * rotationSpeed, deltaY * rotationSpeed);
        setPreviousTouch({ x: event.clientX, y: event.clientY });
      }

      invalidate();
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [processedObj, gl, isDragging, previousTouch.x, previousTouch.y, invalidate, rotationSpeed, texture, onRotationChange, onZRotationChange]);

  // Auto-rotation
  useEffect(() => {
    if (isAutoRotating && !isDragging) {
      const interval = setInterval(() => {
        if (modelRef.current) {
          // Set the rotation speed based on the rotation direction
          const rotationAmount = rotationDirection === 'clockwise' ? -0.01 : 0.01;
          // Notify parent about rotation delta
          onRotationChange?.(0, rotationAmount);
        }
      }, 16);
      return () => clearInterval(interval);
    }
  }, [isAutoRotating, isDragging, rotationDirection, onRotationChange]);

  return <group ref={modelRef} name="phoneModelGroup" />;
}