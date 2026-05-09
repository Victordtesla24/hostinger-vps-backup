import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ConveyerBelt } from './ConveyerBelt3D';
import { StageNode3D } from './StageNode3D';
import { WRParticle3D } from './WRParticle3D';
import { useHOSStore } from '../../store/hosStore';
import type { WRStatus } from '../../types';

// Stage definitions — positions spread left→right
export const STAGE_DEFS: { status: WRStatus; label: string; x: number }[] = [
  { status: 'FRONT_DOOR', label: 'FRONT DOOR', x: -8 },
  { status: 'ASSIGNED',   label: 'ASSIGNED',   x: -4 },
  { status: 'IN_PROGRESS',label: 'IN PROGRESS',x:  0 },
  { status: 'VERIFICATION',label: 'VERIFY',    x:  4 },
  { status: 'PASSED',     label: 'DONE',        x:  8 },
];

function Scene() {
  const workRequests = useHOSStore((s) => s.workRequests);

  // Only show WRs that are in an active pipeline stage (not DRAFT)
  const activeWRs = workRequests.filter(
    (w) => w.status !== 'DRAFT' && w.status !== 'FAILED'
  );

  return (
    <>
      {/* Ambient + directional lighting */}
      <ambientLight color={0x1a1a2e} intensity={0.6} />
      <directionalLight color={0x4fc3f7} intensity={1.4} position={[10, 20, 10]} />
      <pointLight color={0x26c6da} intensity={0.8} position={[0, 5, 5]} />

      {/* Conveyer belt ribbon */}
      <ConveyerBelt />

      {/* Stage nodes */}
      {STAGE_DEFS.map((def) => (
        <StageNode3D key={def.status} def={def} workRequests={workRequests} />
      ))}

      {/* WR particles */}
      {activeWRs.map((wr, i) => (
        <WRParticle3D key={wr.id} wr={wr} index={i} />
      ))}

      {/* Bloom post-processing */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} intensity={1.6} />
      </EffectComposer>

      {/* Camera controls */}
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.05}
        minDistance={8}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

export function PipelineCanvas3D({ height = 320 }: { height?: number }) {
  return (
    <div style={{ height }} className="w-full bg-[#05050f] rounded border border-[#1a1a3e] overflow-hidden">
      <Canvas
        camera={{ position: [0, 8, 18], fov: 55 }}
        gl={{ antialias: true, alpha: false }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <color attach="background" args={['#05050f']} />
        <fog attach="fog" args={['#05050f', 25, 45]} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
