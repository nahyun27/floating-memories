"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture, Text } from "@react-three/drei";
import * as THREE from "three";

function PhotoCard({
  id,
  url,
  position,
  rotationSpeed,
  isSelected,
  isOtherSelected,
  onCardClick
}: {
  id: number;
  url: string;
  position: [number, number, number];
  rotationSpeed: [number, number, number];
  isSelected: boolean;
  isOtherSelected: boolean;
  onCardClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const frontMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const backMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const textTitleRef = useRef<any>(null);
  const textDescRef = useRef<any>(null);

  const texture = useTexture(url);
  const [hovered, setHovered] = useState(false);

  // Use vectors and quaternions allocated once for performance
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const targetEmissive = useMemo(() => new THREE.Color(0x000000), []);
  const defaultPosition = useMemo(() => new THREE.Vector3(...position), [position]);
  const targetPos = useMemo(() => new THREE.Vector3(), []);

  const baseRotation = useRef(new THREE.Euler(0, 0, 0));
  const targetRotQ = useMemo(() => new THREE.Quaternion(), []);
  const flippedRotQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 1. Rotation Update
    if (!isSelected) {
      baseRotation.current.x += rotationSpeed[0] * delta;
      baseRotation.current.y += rotationSpeed[1] * delta;
      baseRotation.current.z += rotationSpeed[2] * delta;
      targetRotQ.setFromEuler(baseRotation.current);
    } else {
      targetRotQ.copy(flippedRotQ);
    }
    const dampFactor = 6;
    groupRef.current.quaternion.slerp(targetRotQ, dampFactor * delta);

    // 2. Position Update
    targetPos.set(
      isSelected ? 0 : defaultPosition.x,
      isSelected ? 0 : defaultPosition.y,
      isSelected ? 5 : defaultPosition.z
    );
    groupRef.current.position.lerp(targetPos, dampFactor * delta);

    // 3. Hover Scale (only if not selected and not dimmed)
    const isHoveredEffect = hovered && !isSelected && !isOtherSelected;
    const scaleValue = isHoveredEffect ? 1.15 : 1;
    targetScale.set(scaleValue, scaleValue, scaleValue);
    groupRef.current.scale.lerp(targetScale, 10 * delta);

    // 4. Hover Emissive Glow
    targetEmissive.setHex(isHoveredEffect ? 0x222222 : 0x000000);
    if (frontMatRef.current) {
      frontMatRef.current.emissive.lerp(targetEmissive, 10 * delta);
    }

    // 5. Opacity Damping for "Other" cards
    const currentTargetOpacity = isOtherSelected ? 0.3 : 1;
    if (frontMatRef.current) {
      frontMatRef.current.opacity = THREE.MathUtils.damp(frontMatRef.current.opacity, currentTargetOpacity, dampFactor, delta);
    }
    if (backMatRef.current) {
      backMatRef.current.opacity = THREE.MathUtils.damp(backMatRef.current.opacity, currentTargetOpacity, dampFactor, delta);
    }
    if (textTitleRef.current) {
      textTitleRef.current.fillOpacity = THREE.MathUtils.damp(textTitleRef.current.fillOpacity, currentTargetOpacity, dampFactor, delta);
    }
    if (textDescRef.current) {
      textDescRef.current.fillOpacity = THREE.MathUtils.damp(textDescRef.current.fillOpacity, currentTargetOpacity, dampFactor, delta);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onCardClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (!isOtherSelected) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Front Face */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial ref={frontMatRef} map={texture} transparent opacity={1} emissive={new THREE.Color(0x000000)} />
      </mesh>

      {/* Back Face */}
      <mesh position={[0, 0, -0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial ref={backMatRef} color="#1a1a1a" transparent opacity={1} />
        <Text
          ref={textTitleRef}
          position={[0, 0.5, 0.02]}
          fontSize={0.25}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {`Photo ${id + 1}`}
        </Text>
        <Text
          ref={textDescRef}
          position={[0, -0.2, 0.02]}
          fontSize={0.15}
          color="#aaa"
          anchorX="center"
          anchorY="middle"
          maxWidth={3.5}
          textAlign="center"
        >
          Captured memory floating endlessly in the digital void. Click to return.
        </Text>
      </mesh>
    </group>
  );
}

function CameraRig({ isAnyCardSelected }: { isAnyCardSelected: boolean }) {
  const { camera, mouse } = useThree();
  const vec = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    // Center camera when focused, otherwise follow mouse
    if (isAnyCardSelected) {
      vec.set(0, 0, 10);
    } else {
      vec.set(mouse.x * 2, mouse.y * 2, 10);
    }
    camera.position.lerp(vec, 0.05);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Scene() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Handle ESC key to exit focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cards = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      // x: -5 to 5, y: -3 to 3, z: -5 to 5
      const position: [number, number, number] = [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 10,
      ];
      // Slow random rotation speeds
      const rotationSpeed: [number, number, number] = [
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
      ];
      // Random image url
      const url = `https://picsum.photos/400/300?random=${i + 1}`;

      return { id: i, url, position, rotationSpeed };
    });
  }, []);

  return (
    <>
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2} />

      {cards.map((card) => (
        <PhotoCard
          key={card.id}
          id={card.id}
          url={card.url}
          position={card.position}
          rotationSpeed={card.rotationSpeed}
          isSelected={selectedId === card.id}
          isOtherSelected={selectedId !== null && selectedId !== card.id}
          onCardClick={() => {
            if (selectedId === card.id) {
              setSelectedId(null);
            } else if (selectedId === null) {
              setSelectedId(card.id);
            }
          }}
        />
      ))}
      <CameraRig isAnyCardSelected={selectedId !== null} />
    </>
  );
}

export default function GalleryPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "black" }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }} onPointerMissed={() => {
        // We'll just rely on the ESC key or clicking the card itself to return
      }}>
        <Scene />
      </Canvas>
    </div>
  );
}
