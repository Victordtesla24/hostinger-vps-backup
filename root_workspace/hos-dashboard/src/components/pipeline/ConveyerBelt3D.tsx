import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ConveyerBelt() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);

  // Animate UV offset to simulate belt motion
  useFrame((_, delta) => {
    if (matRef.current?.map) {
      matRef.current.map.offset.x -= delta * 0.12;
    }
  });

  // Build belt geometry: extruded rectangle spanning all stage nodes
  const beltGeom = new THREE.BoxGeometry(18, 0.12, 1.4);

  // Track rails
  const railGeom = new THREE.BoxGeometry(18, 0.08, 0.06);

  return (
    <group position={[0, -0.6, 0]}>
      {/* Main belt */}
      <mesh geometry={beltGeom} receiveShadow>
        <meshStandardMaterial
          ref={matRef}
          color={0x003d4d}
          emissive={0x001a22}
          emissiveIntensity={0.4}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Left rail */}
      <mesh geometry={railGeom} position={[0, 0.08, 0.72]}>
        <meshStandardMaterial color={0x0a3040} emissive={0x4fc3f7} emissiveIntensity={0.15} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Right rail */}
      <mesh geometry={railGeom} position={[0, 0.08, -0.72]}>
        <meshStandardMaterial color={0x0a3040} emissive={0x4fc3f7} emissiveIntensity={0.15} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Belt tick marks — evenly spaced across belt */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-8 + i * 2, 0.07, 0]}>
          <boxGeometry args={[0.06, 0.06, 1.2]} />
          <meshStandardMaterial color={0x4fc3f7} emissive={0x4fc3f7} emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}
