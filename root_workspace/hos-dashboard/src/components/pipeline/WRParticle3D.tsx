import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorkRequest } from '../../types';
import { STAGE_DEFS } from './PipelineCanvas3D';

const STATUS_COLOR: Record<string, number> = {
  FRONT_DOOR:  0x26c6da,
  ASSIGNED:    0x4fc3f7,
  IN_PROGRESS: 0x4fc3f7,
  VERIFICATION:0xffb300,
  PASSED:      0x66bb6a,
  FAILED:      0xef5350,
};

const GATE_EMISSIVE: Record<string, number> = {
  ARMED:         0xef5350,
  SOFT_RESOLVED: 0xffb300,
  DISARMED:      0x4fc3f7,
};

function stageX(status: string): number {
  return STAGE_DEFS.find((s) => s.status === status)?.x ?? 0;
}

interface Props {
  wr: WorkRequest;
  index: number;
}

export function WRParticle3D({ wr, index }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Stagger particles slightly on Z so they don't overlap
  const zOffset = ((index % 5) - 2) * 0.22;
  const targetX = stageX(wr.status);
  const emissiveColor = GATE_EMISSIVE[wr.gateState] ?? STATUS_COLOR[wr.status] ?? 0x4fc3f7;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    // Lerp towards target stage X position
    mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, targetX, 0.015);

    // Gentle float on Y
    mesh.position.y = Math.sin(clock.elapsedTime * 1.5 + index * 0.7) * 0.12 + 0.3;

    // Rotate slowly
    mesh.rotation.x = clock.elapsedTime * 0.5 + index;
    mesh.rotation.y = clock.elapsedTime * 0.8 + index * 0.5;

    // Pulse emissive intensity based on gate state
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (wr.gateState === 'ARMED') {
      mat.emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * Math.PI * 2) * 0.4;
    } else if (wr.status === 'PASSED') {
      mat.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2) * 0.1;
    } else {
      mat.emissiveIntensity = 0.7;
    }
  });

  // P1 WRs are slightly larger
  const size = wr.priority === 1 ? 0.28 : wr.priority <= 2 ? 0.22 : 0.18;

  return (
    <mesh
      ref={meshRef}
      position={[targetX, 0.3, zOffset]}
    >
      <icosahedronGeometry args={[size, 1]} />
      <meshStandardMaterial
        color={STATUS_COLOR[wr.status] ?? 0x4fc3f7}
        emissive={emissiveColor}
        emissiveIntensity={0.7}
        roughness={0.2}
        metalness={0.5}
        toneMapped={false}
      />
    </mesh>
  );
}
