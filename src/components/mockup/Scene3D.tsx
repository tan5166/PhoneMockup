import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PhoneModel } from '@/components/mockup/PhoneModel';
import { Download, Save, Trash2 } from 'lucide-react';
import * as THREE from 'three';

type PresetAngleName = 'front' | 'right' | 'left';

const presetPoses: { name: PresetAngleName; rotation: THREE.Euler }[] = [
  {
    name: "front",
    rotation: new THREE.Euler(0, 0, 0) // Straight-on front
  },
  {
    name: "right",
    rotation: new THREE.Euler(0, Math.PI / 12, Math.PI / 24) // Y axis 15deg, Z axis 7.5deg
  },
  {
    name: "left",
    rotation: new THREE.Euler(0, -Math.PI / 12, -Math.PI / 24) // Y axis -15deg, Z axis -7.5deg
  }
];

// Handles to the underlying three.js renderer/scene/camera, captured from
// inside the Canvas so code outside the Canvas (e.g. the export handler) can
// drive an offscreen high-resolution render.
interface SceneHandles {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

// Bridge component: lives inside the Canvas and publishes the three.js context
// to a ref owned by the parent component.
function SceneCapture({ handlesRef }: { handlesRef: { current: SceneHandles | null } }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    handlesRef.current = { gl, scene, camera };
  }, [gl, scene, camera, handlesRef]);
  return null;
}

// Camera control component
function CameraController({ zoom }: { zoom: number }) {
  const { camera, invalidate } = useThree();
  
  useEffect(() => {
    const targetZ = zoom;
    const startZ = camera.position.z;
    const duration = 300; // Animation duration (ms)
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use the easeOutQuad easing function
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      
      camera.position.z = startZ + (targetZ - startZ) * easeProgress;
      
      invalidate();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    animate();
  }, [camera, zoom, invalidate]);
  
  return null;
}

// Add a new animation control component
function ModelAnimationController({ 
  rotationX, 
  rotationY, 
  positionX, 
  positionY,
  rotationZ
}: { 
  rotationX: number;
  rotationY: number;
  positionX: number;
  positionY: number;
  rotationZ: number;
}) {
  const { scene, invalidate } = useThree();
  const phoneModel = scene.getObjectByName('phoneModelGroup');
  
  // Temporarily disable animation, directly set properties
  useEffect(() => {
    if (phoneModel) {
      phoneModel.rotation.x = rotationX;
      phoneModel.rotation.y = rotationY;
      phoneModel.rotation.z = rotationZ;
      phoneModel.position.x = positionX;
      phoneModel.position.y = positionY;
      invalidate(); // Ensure the scene re-renders with the new state
    }
  }, [phoneModel, rotationX, rotationY, rotationZ, positionX, positionY, invalidate]);

  return null;
}

interface Scene3DProps {
  screenshotUrl: string | null | undefined;
}


// Preset interfaces (Add these)
interface PresetValue {
  zoom: number;
  posX: number;
  posY: number;
  rotX: number; // Stored in radians
  rotY: number; // Stored in radians
  rotZ: number; // Add Z rotation
}

interface Preset {
  name: string;
  values: PresetValue;
}

export function Scene3D({ screenshotUrl }: Scene3DProps) {
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [rotationDirection, setRotationDirection] = useState<'clockwise' | 'counterclockwise'>('clockwise');
  const [zoom, setZoom] = useState(50);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneHandlesRef = useRef<SceneHandles | null>(null);
  const [showBackground, setShowBackground] = useState(true);
  const CANVAS_HEIGHT = 600;
  const [shellColor, setShellColor] = useState('#3a4054');
  const [backPanelColor, setBackPanelColor] = useState('#414759');
  // Lighting control state
  const [modelRotationX, setModelRotationX] = useState(0);
  const [modelRotationY, setModelRotationY] = useState(0);
  const [modelRotationZ, setModelRotationZ] = useState(0);

  // State for presets (Add this)
  const [savedPresets, setSavedPresets] = useState<Preset[]>([]);
  const LOCAL_STORAGE_KEY = 'phoneMockupPresets';

  // Load presets on mount (Add this useEffect)
  useEffect(() => {
    try {
      const storedPresets = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedPresets) {
        const parsedPresets = JSON.parse(storedPresets);
        // Basic validation
        if (Array.isArray(parsedPresets)) {
           setSavedPresets(parsedPresets);
        } else {
           console.error("Invalid presets found in localStorage:", parsedPresets);
           localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear invalid data
        }
      }
    } catch (error) {
      console.error("Error loading presets from localStorage:", error);
      localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear potentially corrupted data
    }
  }, []); 


  const handleExportModel = async () => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    const { gl, scene, camera } = handles;

    // Supersample factor for a crisp export, independent of the on-screen dpr.
    const EXPORT_SCALE = 4;
    const maxDim = gl.capabilities.maxTextureSize;

    let renderTarget: THREE.WebGLRenderTarget | null = null;

    try {
      // Temporarily hide the background grid so the export has a transparent bg.
      setShowBackground(false);

      // Wait for React to re-render the scene without the grid.
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = gl.domElement;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;

      // Render at EXPORT_SCALE× the display size, capped to the GPU's max
      // texture size so we never exceed what the hardware can allocate.
      const scale = Math.min(
        EXPORT_SCALE,
        maxDim / cssWidth,
        maxDim / cssHeight
      );
      const rtWidth = Math.floor(cssWidth * scale);
      const rtHeight = Math.floor(cssHeight * scale);

      renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        colorSpace: THREE.SRGBColorSpace, // match the on-screen sRGB output
        samples: 4, // MSAA for antialiased edges in the offscreen pass
      });

      // Offscreen high-resolution render. The aspect ratio is unchanged (both
      // dimensions scale equally), so the camera projection needs no update.
      gl.setRenderTarget(renderTarget);
      gl.clear();
      gl.render(scene, camera);

      // Read the pixels (WebGL is bottom-up) and flip vertically into an
      // RGBA buffer suitable for a 2D canvas (top-down).
      const pixels = new Uint8Array(rtWidth * rtHeight * 4);
      gl.readRenderTargetPixels(renderTarget, 0, 0, rtWidth, rtHeight, pixels);
      gl.setRenderTarget(null);

      const flipped = new Uint8ClampedArray(rtWidth * rtHeight * 4);
      const rowBytes = rtWidth * 4;
      for (let y = 0; y < rtHeight; y++) {
        const srcStart = (rtHeight - 1 - y) * rowBytes;
        flipped.set(pixels.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
      }

      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = rtWidth;
      fullCanvas.height = rtHeight;
      const fullCtx = fullCanvas.getContext('2d');
      if (!fullCtx) return;
      fullCtx.putImageData(new ImageData(flipped, rtWidth, rtHeight), 0, 0);

      // Find the bounds of the non-transparent pixels.
      const { data, width, height } = fullCtx.getImageData(0, 0, rtWidth, rtHeight);
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let hasContent = false;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 10) { // Use a threshold to decide whether it is valid content
            hasContent = true;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (!hasContent) {
        console.error('No content found in the canvas');
        return;
      }

      // Add padding, scaled to keep the same visual margin as on screen.
      const padding = Math.round(20 * scale);
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(width, maxX + padding);
      maxY = Math.min(height, maxY + padding);

      // Create a new canvas and draw the cropped content.
      const croppedCanvas = document.createElement('canvas');
      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;

      const croppedCtx = croppedCanvas.getContext('2d');
      if (croppedCtx) {
        // Ensure the canvas background is transparent.
        croppedCtx.clearRect(0, 0, cropWidth, cropHeight);

        // Copy the cropped region.
        croppedCtx.drawImage(
          fullCanvas,
          minX, minY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );

        // Export the cropped image.
        const dataUrl = croppedCanvas.toDataURL('image/png', 1.0);

        // Create a download link.
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'phone-model.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting model:', error);
    } finally {
      // Always restore renderer state, free GPU memory, and show the grid.
      gl.setRenderTarget(null);
      renderTarget?.dispose();
      setShowBackground(true);
    }
  };

  // Apply a preset pose
  const applyPresetPose = useCallback((rotation: THREE.Euler) => {
    // Directly set state instead of dispatching events
    setModelRotationX(rotation.x);
    setModelRotationY(rotation.y);
    setModelRotationZ(rotation.z);
    // Optionally reset position when applying angle presets
    setPositionX(0);
    setPositionY(0);
  }, []);

  // Define the rotation change handler
  const handleRotationChange = useCallback((deltaX: number, deltaY: number) => {
    setModelRotationX(prev => {
      // Clamp X rotation to prevent flipping over
      const newRotation = prev + deltaX;
      return Math.max(Math.min(newRotation, Math.PI / 2), -Math.PI / 2); // Clamp between -90 and +90 degrees
    });
    setModelRotationY(prev => prev + deltaY);
  }, []); // No dependencies needed as it only uses setters

  // Define the Z rotation change handler (Add this)
  const handleZRotationChange = useCallback((deltaZ: number) => {
    setModelRotationZ(prev => prev + deltaZ);
  }, []); // No dependencies needed as it only uses setters

  // --- Preset Handling Functions (Add these) ---
  const handleSavePreset = () => {
    const presetName = prompt("Enter a name for this preset:", `Preset ${savedPresets.length + 1}`);
    if (!presetName) {
      return; // User cancelled
    }
  
    // Check for duplicate name
    if (savedPresets.some(p => p.name === presetName)) {
      alert(`Preset name "${presetName}" already exists. Please choose a different name.`);
      return;
    }
  
    const newPreset: Preset = {
      name: presetName,
      values: {
        zoom: zoom,
        posX: positionX,
        posY: positionY,
        rotX: modelRotationX, // Save radians
        rotY: modelRotationY, // Save radians
        rotZ: modelRotationZ, // Save Z rotation in radians
      },
    };
  
    const updatedPresets = [...savedPresets, newPreset];
    setSavedPresets(updatedPresets);
    try {
       localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPresets));
       alert(`Preset "${presetName}" saved!`);
    } catch (error) {
       console.error("Error saving presets to localStorage:", error);
       alert("Failed to save preset.");
       // Optionally revert state if saving fails
       setSavedPresets(savedPresets);
    }
  };

  const handleApplyPreset = (preset: Preset) => {
    setZoom(preset.values.zoom);
    setPositionX(preset.values.posX);
    setPositionY(preset.values.posY);
    // Directly set rotation state, ModelAnimationController will handle the animation
    setModelRotationX(preset.values.rotX);
    setModelRotationY(preset.values.rotY);
    setModelRotationZ(preset.values.rotZ);
  };

  const handleDeletePreset = (presetNameToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the preset "${presetNameToDelete}"?`)) {
        return;
    }
    const updatedPresets = savedPresets.filter(p => p.name !== presetNameToDelete);
    setSavedPresets(updatedPresets);
     try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPresets));
     } catch (error) {
        console.error("Error saving presets after deletion:", error);
        alert("Failed to update presets after deletion.");
        // Optionally revert state
        setSavedPresets(savedPresets);
     }
  };
  // --- End Preset Handling Functions ---

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Export button group */}
      <div className="w-full flex justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBackground(!showBackground)}
            className={`px-4 py-2 border rounded-xl transition-colors ${
              showBackground 
                ? 'bg-[#6ee7b7]/10 text-[#10b981] border-[#6ee7b7]/30' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {showBackground ? 'Hide Background' : 'Show Background'}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportModel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1c1f23] hover:bg-[#2d3748] text-white transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Image
          </button>
        </div>
      </div>

      {/* Preset pose button group */}
      <div className="w-full flex items-center gap-4 mt-4">
        <span className="text-sm text-gray-600">Preset Angles:</span>
        <div className="flex gap-2">
          {presetPoses.map((pose) => (
            <button
              key={pose.name}
              onClick={() => applyPresetPose(pose.rotation)}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-[#1c1f23] rounded-lg transition-colors text-sm shadow-sm"
            >
              {pose.name.charAt(0).toUpperCase() + pose.name.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* 3D preview area */}
      <div 
        ref={containerRef} 
        className="w-full bg-gray-100 relative"
        style={{
          height: CANVAS_HEIGHT,
        }}
      >
        {loadingProgress > 0 && loadingProgress < 1 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1c1f23]/80 backdrop-blur-sm z-10">
            <div className="w-64 h-3 bg-gray-200 rounded-full overflow-hidden shadow-lg">
              <div 
                className="h-full bg-[#6ee7b7] transition-all duration-500 ease-out"
                style={{ width: `${loadingProgress * 100}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-white font-medium">
              Loading... {Math.round(loadingProgress * 100)}%
            </p>
          </div>
        )}
        
        <Canvas
          dpr={[1, 3]}
          camera={{ position: [0, 0, 80], fov: 20 }}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            precision: "highp",
            depth: true,
            stencil: false,
            logarithmicDepthBuffer: true,
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.NoToneMapping,
          }}
          style={{
            width: '100%',
            height: '100%',
            background: '#f0f0f0',
          }}
          flat
          frameloop={isAutoRotating ? 'always' : 'demand'}
        >
          <Suspense fallback={null}>
            <SceneCapture handlesRef={sceneHandlesRef} />
            <CameraController zoom={zoom} />
            <ModelAnimationController 
              rotationX={modelRotationX}
              rotationY={modelRotationY}
              rotationZ={modelRotationZ}
              positionX={positionX}
              positionY={positionY}
            />

            {showBackground && (
              <gridHelper args={[40, 40]} position={[0, -8, 0]} />
            )}
            <group position={[positionX, positionY, 0]}>
              <PhoneModel
                screenshotUrl={screenshotUrl}
                isAutoRotating={isAutoRotating}
                onLoadProgress={setLoadingProgress}
                rotationDirection={rotationDirection}
                onRotationChange={handleRotationChange}
                onZRotationChange={handleZRotationChange}
                shellColor={shellColor}
                backPanelColor={backPanelColor}
              />
            </group>

            {/* Base ambient light */}
            <ambientLight intensity={0.3} color="#ffffff" />
            
            {/* Key light: powerful spotlight */}
            <spotLight 
              position={[0, 0, 100]} 
              intensity={8.0}
              color="#ffffff"
              distance={200}
              angle={Math.PI / 4}
              penumbra={0.2}
              decay={1.5}
            />
            
            {/* Edge lighting: spotlights at the four corners */}
            <spotLight 
              position={[50, 50, 50]} 
              intensity={4.0}
              color="#ffffff"
              distance={150}
              angle={Math.PI / 4}
              penumbra={0.2}
              decay={1.5}
            />
            <spotLight 
              position={[-50, 50, 50]} 
              intensity={4.0}
              color="#ffffff"
              distance={150}
              angle={Math.PI / 4}
              penumbra={0.2}
              decay={1.5}
            />
            <spotLight 
              position={[50, -50, 50]} 
              intensity={4.0}
              color="#ffffff"
              distance={150}
              angle={Math.PI / 4}
              penumbra={0.2}
              decay={1.5}
            />
            <spotLight 
              position={[-50, -50, 50]} 
              intensity={4.0}
              color="#ffffff"
              distance={150}
              angle={Math.PI / 4}
              penumbra={0.2}
              decay={1.5}
            />
            
            {/* Side fill light */}
            <directionalLight 
              position={[100, 0, 50]} 
              intensity={2.0}
              color="#ffffff"
            />
            <directionalLight 
              position={[-100, 0, 50]} 
              intensity={2.0}
              color="#ffffff"
            />
            
            {/* Top and bottom fill light */}
            <directionalLight 
              position={[0, 100, 50]} 
              intensity={1.5}
              color="#ffffff"
            />
            <directionalLight 
              position={[0, -100, 50]} 
              intensity={1.5}
              color="#ffffff"
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Parameter Display & Save Preset Button (Modify this section) */}
      <div className="w-full flex items-center justify-between gap-4 mt-4 mb-2">
        <div className="flex-grow bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 grid grid-cols-6 gap-2 shadow-sm">
          <div>Zoom: <span className="font-mono text-gray-800">{ zoom.toFixed(1) }</span></div>
          <div>H Pos: <span className="font-mono text-gray-800">{ positionX.toFixed(1) }</span></div>
          <div>V Pos: <span className="font-mono text-gray-800">{ positionY.toFixed(1) }</span></div>
          <div>X Rot: <span className="font-mono text-gray-800">{ (modelRotationX * 180 / Math.PI).toFixed(1) }°</span></div>
          <div>Y Rot: <span className="font-mono text-gray-800">{ (modelRotationY * 180 / Math.PI).toFixed(1) }°</span></div>
          <div>Z Rot: <span className="font-mono text-gray-800">{ (modelRotationZ * 180 / Math.PI).toFixed(1) }°</span></div>
        </div>
        <button
          onClick={handleSavePreset}
          className="flex items-center gap-2 px-4 py-2 bg-white text-[#1c1f23] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm"
          title="Save Current View as Preset"
        >
          <Save size={14} />
          Save Preset
        </button>
      </div>
      
      {/* Saved Presets List (Updated UI/UX) */}
      {savedPresets.length > 0 && (
        <div className="w-full bg-white border border-gray-100 rounded-xl shadow-sm p-4 mb-4">
          <h3 className="text-sm font-medium text-[#1c1f23] mb-3">Saved Presets</h3>
          <div className="flex flex-wrap gap-2">
            {savedPresets.map((preset) => (
              <div key={preset.name} className="relative group">
                <button
                  onClick={() => handleApplyPreset(preset)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm transition-colors shadow-sm pr-8" // Add padding-right for delete button space
                  title={`Apply preset: ${preset.name}`}
                >
                  {preset.name}
                </button>
                <button
                   onClick={(e) => {
                       e.stopPropagation(); // Prevent applying preset when deleting
                       handleDeletePreset(preset.name);
                   }}
                   className="absolute top-1/2 right-1.5 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-md transition-all opacity-0 group-hover:opacity-100"
                   title="Delete Preset"
                 >
                   <Trash2 size={14} />
                 </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Panels */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {/* Model controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-medium text-[#1c1f23] mb-3">Model Controls</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="zoom" className="text-sm text-gray-600">Zoom</label>
                <span className="text-xs text-gray-500">{zoom}</span>
              </div>
              <input
                id="zoom"
                type="range"
                min="30"
                max="60"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#6ee7b7]"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                onClick={() => applyPresetPose(presetPoses.find(pose => pose.name === 'left')?.rotation || new THREE.Euler(0, 0, 0))}
                className="flex flex-col items-center justify-center py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span className="text-xs">Left View</span>
              </button>
              <button
                onClick={() => applyPresetPose(presetPoses.find(pose => pose.name === 'front')?.rotation || new THREE.Euler(0, 0, 0))}
                className="flex flex-col items-center justify-center py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <span className="text-xs">Front View</span>
              </button>
              <button
                onClick={() => applyPresetPose(presetPoses.find(pose => pose.name === 'right')?.rotation || new THREE.Euler(0, 0, 0))}
                className="flex flex-col items-center justify-center py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span className="text-xs">Right View</span>
              </button>
            </div>
            
            <div className="flex justify-between mt-4">
              <button
                onClick={() => {
                  setModelRotationX(0);
                  setModelRotationY(0);
                  setPositionX(0);
                  setPositionY(0);
                  setModelRotationZ(0);
                }}
                className="flex items-center justify-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 shadow-sm text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                Reset Position
              </button>
              <button
                onClick={() => setIsAutoRotating(!isAutoRotating)}
                className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg shadow-sm text-sm ${
                  isAutoRotating
                    ? 'bg-[#6ee7b7]/10 text-[#10b981] border border-[#6ee7b7]/30'
                    : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  <path d="M15.4 10a4 4 0 1 0 0 4" />
                </svg>
                {isAutoRotating ? 'Stop Rotation' : 'Auto Rotate'}
              </button>
            </div>

            {/* Add Rotation Direction Control Here */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="rotDir" className="text-sm text-gray-600">Auto-Rotation Direction</label>
              </div>
              <div className="flex border rounded-lg overflow-hidden shadow-sm">
                <button
                  onClick={() => setRotationDirection('clockwise')}
                  className={`w-1/2 py-1.5 text-xs ${
                    rotationDirection === 'clockwise'
                      ? 'bg-[#6ee7b7]/10 text-[#10b981] font-medium'
                      : 'bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  Clockwise
                </button>
                <button
                  onClick={() => setRotationDirection('counterclockwise')}
                  className={`w-1/2 py-1.5 text-xs ${
                    rotationDirection === 'counterclockwise'
                      ? 'bg-[#6ee7b7]/10 text-[#10b981] font-medium'
                      : 'bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  Counter-clockwise
                </button>
              </div>
            </div>

            {/* Add X Rotation Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="rotX" className="text-sm text-gray-600">X Rotation</label>
                <span className="text-xs text-gray-500">{(modelRotationX * 180 / Math.PI).toFixed(1)}°</span>
              </div>
              <input
                id="rotX"
                type="range"
                min="-90"  // Limit X rotation to -90 to +90 degrees
                max="90"
                step="1"
                value={modelRotationX * 180 / Math.PI}
                onChange={(e) => setModelRotationX(Number(e.target.value) * Math.PI / 180)}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#6ee7b7]"
              />
            </div>

            {/* Add Y Rotation Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="rotY" className="text-sm text-gray-600">Y Rotation</label>
                <span className="text-xs text-gray-500">{(modelRotationY * 180 / Math.PI).toFixed(1)}°</span>
              </div>
              <input
                id="rotY"
                type="range"
                min="-180"
                max="180"
                step="1"
                value={modelRotationY * 180 / Math.PI}
                onChange={(e) => setModelRotationY(Number(e.target.value) * Math.PI / 180)}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#6ee7b7]"
              />
            </div>

            {/* Z Rotation Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="rotZ" className="text-sm text-gray-600">Z Rotation</label>
                <span className="text-xs text-gray-500">{(modelRotationZ * 180 / Math.PI).toFixed(1)}°</span>
              </div>
              <input
                id="rotZ"
                type="range"
                min="-180"
                max="180"
                step="1"
                value={modelRotationZ * 180 / Math.PI}
                onChange={(e) => setModelRotationZ(Number(e.target.value) * Math.PI / 180)}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#6ee7b7]"
              />
              {/* Add Hint for Shift + Drag */}
              <p className="text-xs text-gray-500 mt-1.5 text-center">Tip: Hold <kbd className="px-1 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md">Shift</kbd> + Drag Horizontally to rotate Z-axis.</p>
            </div>

          </div>
        </div>

        {/* Right column: Position + Color */}
        <div className="flex flex-col gap-4">
          {/* Position controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-medium text-[#1c1f23] mb-3">Position Controls</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="posX" className="text-sm text-gray-600">Horizontal Position</label>
                <span className="text-xs text-gray-500">{positionX.toFixed(1)}</span>
              </div>
              <input
                id="posX"
                type="range"
                min="-10"
                max="10"
                step="0.5"
                value={positionX}
                onChange={(e) => setPositionX(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#6ee7b7]"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="posY" className="text-sm text-gray-600">Vertical Position</label>
                <span className="text-xs text-gray-500">{positionY.toFixed(1)}</span>
              </div>
              <input
                id="posY"
                type="range"
                min="-10"
                max="10"
                step="0.5"
                value={positionY}
                onChange={(e) => setPositionY(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#6ee7b7]"
              />
            </div>
          </div>
          </div>

          {/* Color controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-medium text-[#1c1f23] mb-3">Color Controls</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">Shell Color</label>
                <input
                  type="color"
                  value={shellColor}
                  onChange={(e) => setShellColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">Back Panel Color</label>
                <input
                  type="color"
                  value={backPanelColor}
                  onChange={(e) => setBackPanelColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}