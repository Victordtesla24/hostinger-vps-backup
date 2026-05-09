import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { WorkRequest, WRStatus, PipelineMetrics } from '../../types';
import type { STAGE_DEFS } from './PipelineCanvas3D';
import { useHOSStore } from '../../store/hosStore';

const STATUS_EMISSIVE: Record<string, number> = {
  idle: 0x546e7a,
  active: 0x4fc3f7,
  armed: 0xf44336,
  passed: 0x66bb6a,
};

interface Props {
  def: (typeof STAGE_DEFS)[number];
  workRequests: WorkRequest[];
}

function getNodeState(status: WRStatus, wrs: WorkRequest[]): 'idle' | 'active' | 'armed' | 'passed' {
  const here = wrs.filter((w) => w.status === status);
  if (here.length === 0) return 'idle';
  if (status === 'VERIFICATION' && here.some((w) => w.gateState === 'ARMED')) return 'armed';
  if (status === 'PASSED') return 'passed';
  return 'active';
}

export function StageNode3D({ def, workRequests }: Props) {
  const lightRef = useRef<THREE.PointLight>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const [throughputScale, setThroughputScale] = useState(1.0);

  // Keep a stable ref to metrics so the interval closure never goes stale
  const metricsRef = useRef<PipelineMetrics | null>(null);
  metricsRef.current = useHOSStore((s) => s.pipelineMetrics);

  // Sample throughput from the store every 5 seconds
  useEffect(() => {
    const computeScale = () => {
      const breakdown = metricsRef.current?.stageBreakdown ?? {};
      const counts = Object.values(breakdown);
      const max = Math.max(...counts, 1);
      const count = breakdown[def.status] ?? 0;
      // Map 0→max into 0.85→1.30: idle nodes shrink slightly, busy nodes grow
      setThroughputScale(0.85 + (count / max) * 0.45);
    };
    computeScale();
    const id = setInterval(computeScale, 5000);
    return () => clearInterval(id);
  }, [def.status]);

  const state = getNodeState(def.status, workRequests);
  const emissiveColor = STATUS_EMISSIVE[state] ?? 0x546e7a;
  const queueCount = workRequests.filter((w) => w.status === def.status).length;

  // Pulse the point light on ARMED state; gentle throb on active
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.elapsedTime;
    if (state === 'armed') {
      lightRef.current.intensity = 1.2 + Math.sin(t * Math.PI * 2) * 0.8;
    } else if (state === 'active') {
      lightRef.current.intensity = 0.5 + Math.sin(t * 1.2) * 0.2;
    } else {
      lightRef.current.intensity = 0.2;
    }

    // Blend hover scale with throughput scale; lerp for smooth transitions
    if (meshRef.current) {
      const targetScale = (hovered ? 1.06 : 1) * throughputScale;
      meshRef.current.scale.setScalar(
        THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.08)
      );
    }
  });

  return (
    <group position={[def.x, 0, 0]}>
      {/* Glow light at the node */}
      <pointLight
        ref={lightRef}
        color={emissiveColor}
        intensity={0.3}
        distance={3.5}
        decay={2}
      />

      {/* Node box */}
      <RoundedBox
        ref={meshRef}
        args={[2.2, 1.1, 0.9]}
        radius={0.12}
        smoothness={4}
        castShadow
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={0x0d0d20}
          emissive={emissiveColor}
          emissiveIntensity={state === 'armed' ? 0.9 : state === 'active' ? 0.5 : 0.15}
          roughness={0.4}
          metalness={0.6}
        />
      </RoundedBox>

      {/* Label */}
      <Text
        position={[0, 0.75, 0.46]}
        fontSize={0.18}
        color={state === 'idle' ? '#546e7a' : '#c8d6e5'}
        anchorX="center"
        anchorY="middle"
        font={undefined}
        maxWidth={2}
      >
        {def.label}
      </Text>

      {/* Queue count badge */}
      {queueCount > 0 && (
        <Text
          position={[0, -0.1, 0.46]}
          fontSize={0.28}
          color={state === 'armed' ? '#ef5350' : '#4fc3f7'}
          anchorX="center"
          anchorY="middle"
        >
          {queueCount}
        </Text>
      )}

      {/* GATE ARMED indicator ring */}
      {state === 'armed' && (
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.4, 0.04, 8, 48]} />
          <meshStandardMaterial
            color={0xef5350}
            emissive={0xef5350}
            emissiveIntensity={1.2}
          />
        </mesh>
      )}
    </group>
  );
}
