import dynamic from 'next/dynamic';

/**
 * Client-only build of the mockup tool. It renders a WebGL/three.js scene, so
 * it must be loaded with `ssr: false`. Shared by the pages that embed the tool.
 */
export const IphoneMockupClient = dynamic(
  () => import('@/components/mockup/IphoneMockup').then((mod) => mod.IphoneMockup),
  { ssr: false }
);
