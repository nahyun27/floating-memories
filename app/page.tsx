"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture, Text, Html, CameraControls, Image } from "@react-three/drei";
import { EffectComposer, DepthOfField } from "@react-three/postprocessing";
import * as THREE from "three";
import { useSpring, a } from "@react-spring/three";

// --- Types & Data ---
type ViewLevel = 'universe' | 'cluster' | 'photo';

interface PhotoMetadata {
  id: string;
  url: string;
  title: string;
  date: string;
  description: string;
}

interface GalaxyData {
  id: string;
  name: string;
  color: string;
  position: [number, number, number];
  photos: PhotoMetadata[];
}

const MAX_PHOTOS_PER_GALAXY = 8; // Performance cap: limit visible cards per galaxy

const GALAXIES: GalaxyData[] = [
  {
    id: 'g1',
    name: "Summer 2023 ☀️",
    color: "#ffaa00",
    position: [-15, 5, -20],
    photos: [
      "6848392B-CD45-46B1-8389-C983D3422E0A.jpg", "IMG_0035.PNG", "IMG_0119.JPG", "IMG_0137.JPG",
      "IMG_0155.JPG", "IMG_0156.JPG", "IMG_0168.JPG", "IMG_0170.JPG", "IMG_0179.JPG", "IMG_0193.JPG",
      "IMG_0274.JPG", "IMG_0278.JPG", "IMG_0300.JPG", "IMG_0394.JPG", "IMG_0402.JPG", "IMG_0439.JPG",
      "IMG_9218.JPG", "IMG_9221.JPG", "IMG_9954.JPG", "IMG_9957.JPG", "IMG_9982.JPG"
    ].slice(0, MAX_PHOTOS_PER_GALAXY).map((filename, i) => ({
      id: `g1-p${i}`,
      url: `/memories/g1/${filename}`,
      title: `Summer Memory ${i + 1}`,
      date: `Aug 2023`,
      description: "Warm days, beautiful skies, and endless laughter. A collection of unforgettable moments.",
    }))
  },
  {
    id: 'g2',
    name: "Lab Life 🔬",
    color: "#00aaff",
    position: [15, -5, -25],
    photos: [
      "IMG_0204.JPG", "IMG_0218.JPG", "IMG_1111.JPG", "IMG_1147.JPG", "IMG_1153.JPG",
      "IMG_1166.JPG", "IMG_1171.JPG", "IMG_1215.JPG", "IMG_1220.JPG", "IMG_1432.JPG",
      "IMG_1547.JPG", "IMG_1615.JPG", "IMG_1724.JPG", "IMG_1760.JPG", "IMG_1767.JPG"
    ].slice(0, MAX_PHOTOS_PER_GALAXY).map((filename, i) => ({
      id: `g2-p${i}`,
      url: `/memories/g2/${filename}`,
      title: `Lab Snapshot ${i + 1}`,
      date: `Oct 2023`,
      description: "Those late-night research sessions and endless cups of coffee. We worked so hard.",
    }))
  },
  {
    id: 'g3',
    name: "Travel ✈️",
    color: "#aa00ff",
    position: [-5, -12, -15],
    photos: [
      "96A97649-0A8E-442D-97C0-4C3114D3CA43.jpg", "IMG_0494.JPG", "IMG_0594.JPG", "IMG_0603.JPG",
      "IMG_0879.JPG", "IMG_1695.jpeg", "IMG_9190.JPG"
    ].slice(0, MAX_PHOTOS_PER_GALAXY).map((filename, i) => ({
      id: `g3-p${i}`,
      url: `/memories/g3/${filename}`,
      title: `Adventure ${i + 1}`,
      date: `Dec 2023`,
      description: "Exploring new places around the world. Every street corner had a story.",
    }))
  },
  {
    id: 'g4',
    name: "Friends & Family 💖",
    color: "#ff00aa",
    position: [10, 10, -10],
    photos: [
      "IMG_9245.JPG", "IMG_9281.JPG", "IMG_9349.JPG", "IMG_9350.JPG", "IMG_9358.JPG",
      "IMG_9421.JPG", "IMG_9442.JPG", "IMG_9444.JPG", "IMG_9445.JPG", "IMG_9454.JPG"
    ].slice(0, MAX_PHOTOS_PER_GALAXY).map((filename, i) => ({
      id: `g4-p${i}`,
      url: `/memories/g4/${filename}`,
      title: `Gathering ${i + 1}`,
      date: `Jan 2024`,
      description: "The people who matter the most. Countless memories made over good food and better conversations.",
    }))
  }
];

// --- Fallback Texture Helper ---
function useAsyncTexture(url: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        if (!active) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        setTexture(tex);
      },
      undefined,
      (err) => {
        if (!active) return;
        console.error("Failed to load texture:", url, err);
        setError(true);
      }
    );
    return () => { active = false; };
  }, [url]);

  return { texture, error };
}

// --- Components ---

function BackgroundStars({ count = 1000 }) {
  const pointsRef = useRef<THREE.Points>(null);
  const [positions] = useState(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      coords[i * 3] = (Math.random() - 0.5) * 100;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 100;
      coords[i * 3 + 2] = (Math.random() - 0.5) * 100 - 20;
    }
    return coords;
  });

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.005;
      pointsRef.current.rotation.x += delta * 0.002;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#ffffff" transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

// Always-visible galaxy label with distance-based opacity
function GalaxyLabel({ name, hovered, color }: { name: string; hovered: boolean; color: string }) {
  // Use Html overlay (no external font loading, always works)
  const [opacity, setOpacity] = useState(0);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    const dist = camera.position.distanceTo(worldPos);
    // Fade: visible from dist 15-40, hidden beyond 50
    const fade = Math.min(1, Math.max(0, 1 - (dist - 18) / 22));
    setOpacity(hovered ? Math.min(1, fade + 0.4) : fade);
  });

  return (
    <group ref={groupRef} position={[0, -3.5, 0]}>
      <Html center style={{ pointerEvents: 'none', transition: 'opacity 0.3s' }}>
        <div style={{
          opacity,
          color: hovered ? '#ffffff' : color,
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 'bold',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          textShadow: `0 0 12px ${color}`,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          transition: 'opacity 0.3s, color 0.3s',
        }}>
          {name}
        </div>
      </Html>
    </group>
  );
}

// Level 1: A single Galaxy cluster of particles
function GalaxyParticleCluster({
  galaxy,
  onClick
}: {
  galaxy: GalaxyData;
  onClick: () => void;
}) {
  const count = 400;
  const pointsRef = useRef<THREE.Points>(null);
  const [hovered, setHovered] = useState(false);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const baseColor = new THREE.Color(galaxy.color);
    const centerColor = new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 2) * 4;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const mixRatio = Math.min(r / 4, 1);
      const mixedColor = centerColor.clone().lerp(baseColor, mixRatio);

      col[i * 3] = mixedColor.r;
      col[i * 3 + 1] = mixedColor.g;
      col[i * 3 + 2] = mixedColor.b;
    }
    return [pos, col];
  }, [galaxy.color]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.2;
      pointsRef.current.rotation.z += delta * 0.1;
    }
  });

  const { scale } = useSpring({
    scale: hovered ? 1.2 : 1,
    config: { mass: 1, tension: 280, friction: 60 }
  });

  return (
    <a.group position={galaxy.position} scale={scale}>
      <points
        ref={pointsRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} array={positions} count={count} itemSize={3} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} array={colors} count={count} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.1} vertexColors transparent opacity={0.8} />
      </points>

      {/* Always-visible label with distance fade */}
      <GalaxyLabel name={galaxy.name} hovered={hovered} color={galaxy.color} />
    </a.group>
  );
}

// Warp Effect: streak particles when zooming into a galaxy
function WarpEffect({ active }: { active: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const count = 300;
  const progress = useRef(0);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 4;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.sin(angle) * r;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80; // long streaks along Z
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !matRef.current) return;

    if (active) {
      progress.current = Math.min(1, progress.current + delta * 2);
    } else {
      progress.current = Math.max(0, progress.current - delta * 3);
    }

    // Rush forward and fade out
    pointsRef.current.position.z = progress.current * 20;
    matRef.current.opacity = Math.sin(progress.current * Math.PI) * 0.7;
    matRef.current.size = 0.04 + progress.current * 0.15;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial ref={matRef} color="#aaccff" transparent opacity={0} sizeAttenuation size={0.04} />
    </points>
  );
}

// Level 2 & 3: Photo Card
function PhotoCard({
  photo,
  index,
  total,
  level,
  isSelected,
  hoveredIndex = null,
  setHoveredIndex,
  onCardClick,
  onTextureLoaded,
}: {
  photo: PhotoMetadata;
  index: number;
  total: number;
  level: ViewLevel;
  isSelected: boolean;
  hoveredIndex?: number | null;
  setHoveredIndex?: (idx: number | null) => void;
  onCardClick: () => void;
  onTextureLoaded?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const imageRef = useRef<any>(null);
  const { texture, error } = useAsyncTexture(photo.url);
  const isHovered = hoveredIndex === index && level === 'cluster';
  const notifiedLoad = useRef(false);

  useEffect(() => {
    if (imageRef.current && imageRef.current.material && texture) {
      imageRef.current.material.needsUpdate = true;
    }
    // Notify parent once when texture first loads
    if (texture && !notifiedLoad.current) {
      notifiedLoad.current = true;
      onTextureLoaded?.();
    }
  }, [texture, isSelected, onTextureLoaded]);

  // Calculate base position — wider circular distribution to reduce overlap
  const angle = (index / total) * Math.PI * 2;
  // Seed a stable radius from index so it doesn't recalculate on re-renders
  const radius = 10 + (index % 3) * 1.5; // Wider: 10-13 range
  const basePos = useMemo(() => new THREE.Vector3(
    Math.cos(angle) * radius,
    ((index % 5) - 2) * 2.5,  // Spread vertically as well, stable not random
    Math.sin(angle) * radius * 0.6,
  ), [angle, index, radius]);

  // If another card is hovered, calculate a repel vector
  const repelVector = useMemo(() => new THREE.Vector3(), []);

  const rotationSpeed = useMemo(() => [
    (Math.random() - 0.5) * 0.08,
    (Math.random() - 0.5) * 0.08,
    (Math.random() - 0.5) * 0.08,
  ], []);

  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  const baseRotation = useRef(new THREE.Euler(0, 0, 0));
  const targetRotQ = useMemo(() => new THREE.Quaternion(), []);
  const flatRotQ = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)), []);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dampFactor = 6;

    if (level === 'cluster') {
      // 1. Cluster View Logic (Floating in space)
      baseRotation.current.x += rotationSpeed[0] * delta;
      baseRotation.current.y += rotationSpeed[1] * delta;
      baseRotation.current.z += rotationSpeed[2] * delta;
      targetRotQ.setFromEuler(baseRotation.current);

      const driftY = Math.sin(state.clock.elapsedTime * 0.5 + phaseOffset) * 0.4;
      targetPos.copy(basePos);
      targetPos.y += driftY;

      // Repel logic: if another card is hovered, push this one away slightly
      if (hoveredIndex !== null && hoveredIndex !== index) {
        // Calculate the base position of the hovered card (rough approximation based on index)
        const hoveredAngle = (hoveredIndex / total) * Math.PI * 2;
        const hoveredBasePos = new THREE.Vector3(
          Math.cos(hoveredAngle) * radius,
          0, // Ignore Y for horizontal repel
          Math.sin(hoveredAngle) * radius * 0.5 - 2
        );

        repelVector.subVectors(basePos, hoveredBasePos);
        const distance = repelVector.length();

        if (distance < 6) { // If close enough to the hovered card
          repelVector.normalize().multiplyScalar((6 - distance) * 0.5); // Push away radially
          targetPos.add(repelVector);
        }
      }

      groupRef.current.position.lerp(targetPos, dampFactor * delta);
      groupRef.current.quaternion.slerp(targetRotQ, dampFactor * delta);

    } else if (level === 'photo') {
      if (isSelected) {
        // Bring to front but shift slightly left so right-side HTML overlay fits beautifully
        targetPos.set(-1.5, 0, 6);
        targetRotQ.copy(flatRotQ); // Just flat, no custom dragging
      } else {
        // Push others out of view
        targetPos.copy(basePos).multiplyScalar(1.5);
        targetRotQ.setFromEuler(baseRotation.current);
      }
      groupRef.current.position.lerp(targetPos, dampFactor * delta);
      groupRef.current.quaternion.slerp(targetRotQ, dampFactor * delta);
    }

    // 3. Smooth Hover Scale & Glow Effect
    // Scale up slightly when hovered, scale down slightly when avoiding
    let scaleValue = 1;
    if (isHovered) {
      scaleValue = 1.15; // Smooth scale up for the focal target
    } else if (hoveredIndex !== null && level === 'cluster') {
      // If another card is hovered, shrink slightly while moving away
      scaleValue = 0.95;
    }

    targetScale.set(scaleValue, scaleValue, scaleValue);
    groupRef.current.scale.lerp(targetScale, 6 * delta);

    // Gentle brightening on hover
    if (imageRef.current && imageRef.current.material) {
      imageRef.current.material.color.lerp(
        new THREE.Color(isHovered ? 0xffffff : 0xdddddd),
        5 * delta
      );
    }
  });

  return (
    <group
      ref={groupRef}
      position={basePos}
      onClick={(e) => {
        e.stopPropagation();
        if (level === 'cluster') onCardClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (level === 'cluster' && setHoveredIndex) {
          setHoveredIndex(index);
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        if (level === 'cluster' && setHoveredIndex) {
          setHoveredIndex(null);
          document.body.style.cursor = 'auto';
        }
      }}
    >
      {/* Main image — double-sided so card back doesn't show black when rotated */}
      {texture ? (
        <Image
          ref={imageRef}
          texture={texture}
          transparent
          opacity={level === 'photo' && !isSelected ? 0 : 1}
          scale={[4.5, 3.2]}
          // @ts-ignore - side is a valid material prop
          side={THREE.DoubleSide}
        />
      ) : (
        <mesh>
          <planeGeometry args={[4.5, 3.2]} />
          <meshBasicMaterial color="#1a1a2e" side={THREE.DoubleSide} transparent opacity={level === 'photo' && !isSelected ? 0 : 1} />
          {!error && (
            <Html center zIndexRange={[100, 0]}>
              <div className="text-white/40 text-[10px] tracking-widest animate-pulse pointer-events-none" style={{ fontFamily: 'monospace' }}>LOADING</div>
            </Html>
          )}
        </mesh>
      )}

      {/* No back face needed anymore — DoubleSide handles it! */}
    </group>
  );
}

// Level 2: Cluster View (displays photos of a single galaxy)
function ClusterView({
  galaxy,
  level,
  activePhotoId,
  onPhotoClick,
  onBack,
  onReady,
}: {
  galaxy: GalaxyData;
  level: ViewLevel;
  activePhotoId: string | null;
  onPhotoClick: (photo: PhotoMetadata) => void;
  onBack: () => void;
  onReady?: () => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const loadedCount = useRef(0);
  const readyCalled = useRef(false);

  const handlePhotoLoaded = () => {
    loadedCount.current += 1;
    // Fire onReady once the first 2 photos have their textures (feels responsive)
    if (!readyCalled.current && loadedCount.current >= Math.min(2, galaxy.photos.length)) {
      readyCalled.current = true;
      onReady?.();
    }
  };

  return (
    <group position={galaxy.position}>
      {/* Subtle residual galaxy core behind the cards */}
      <pointLight position={[0, 0, 0]} intensity={2} color={galaxy.color} distance={30} />

      {galaxy.photos.map((photo, index) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          index={index}
          total={galaxy.photos.length}
          level={level}
          isSelected={activePhotoId === photo.id}
          hoveredIndex={hoveredIndex}
          setHoveredIndex={setHoveredIndex}
          onCardClick={() => onPhotoClick(photo)}
          onTextureLoaded={handlePhotoLoaded}
        />
      ))}
    </group>
  );
}


// Controls Camera based on View Level using CameraControls for free dragging
function CameraRig({
  level,
  activeGalaxy
}: {
  level: ViewLevel;
  activeGalaxy: GalaxyData | null;
}) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    // Smooth transition camera rig for 3 stages
    if (level === 'universe') {
      controls.setLookAt(0, 5, 45, 0, 0, 0, true);
    } else if (level === 'cluster' && activeGalaxy) {
      const { position } = activeGalaxy;
      controls.setLookAt(
        position[0], position[1], position[2] + 20,
        position[0], position[1], position[2],
        true
      );
    } else if (level === 'photo' && activeGalaxy) {
      // Look slightly to the left relative to the image
      const { position } = activeGalaxy;
      controls.setLookAt(
        position[0], position[1], position[2] + 12,
        position[0] - 0.5, position[1], position[2] + 6,
        true
      );
    }
  }, [level, activeGalaxy]);

  return <CameraControls ref={controlsRef} makeDefault />;
}

// --- Main Scene ---

function Scene({
  level,
  setLevel,
  activeGalaxyId,
  setActiveGalaxyId,
  activeGalaxy,
  activePhotoId,
  setActivePhotoId,
  onGalaxyEnter,
  onClusterReady,
}: {
  level: ViewLevel;
  setLevel: (l: ViewLevel) => void;
  activeGalaxyId: string | null;
  setActiveGalaxyId: (id: string | null) => void;
  activeGalaxy: GalaxyData | null;
  activePhotoId: string | null;
  setActivePhotoId: (id: string | null) => void;
  onGalaxyEnter: () => void;
  onClusterReady: () => void;
}) {
  const [warpActive, setWarpActive] = useState(false);
  // Global Keybindings for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (level === 'photo') {
          setLevel('cluster');
          setActivePhotoId(null);
        } else if (level === 'cluster') {
          setLevel('universe');
          setActiveGalaxyId(null);
        }
      }
      if (level === 'photo' && activeGalaxy && activePhotoId) {
        const currentIndex = activeGalaxy.photos.findIndex(p => p.id === activePhotoId);
        if (e.key === 'ArrowRight' && currentIndex < activeGalaxy.photos.length - 1) {
          setActivePhotoId(activeGalaxy.photos[currentIndex + 1].id);
        } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setActivePhotoId(activeGalaxy.photos[currentIndex - 1].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [level, activeGalaxy, activePhotoId, setLevel, setActiveGalaxyId, setActivePhotoId]);

  return (
    <>
      <color attach="background" args={['#020205']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-5, -5, -5]} intensity={0.5} color="#4455ff" />
      <BackgroundStars count={2000} />

      {/* Level 1: Universe */}
      {level === 'universe' && GALAXIES.map((galaxy) => (
        <GalaxyParticleCluster
          key={galaxy.id}
          galaxy={galaxy}
          onClick={() => {
            onGalaxyEnter();
            setWarpActive(true);
            setTimeout(() => {
              setActiveGalaxyId(galaxy.id);
              setLevel('cluster');
              setWarpActive(false);
            }, 600);
          }}
        />
      ))}

      {/* Level 2 & 3: Cluster + Photo */}
      {(level === 'cluster' || level === 'photo') && activeGalaxy && (
        <ClusterView
          galaxy={activeGalaxy}
          level={level}
          activePhotoId={activePhotoId}
          onPhotoClick={(photo) => {
            setActivePhotoId(photo.id);
            setLevel('photo');
          }}
          onBack={() => {
            setLevel('universe');
            setActiveGalaxyId(null);
          }}
          onReady={onClusterReady}
        />
      )}

      <CameraRig level={level} activeGalaxy={activeGalaxy} />
      <WarpEffect active={warpActive} />

      {level === 'universe' && (
        <EffectComposer>
          <DepthOfField focusDistance={0.05} focalLength={0.15} bokehScale={3} height={360} />
        </EffectComposer>
      )}
    </>
  );
}

// --- Loading Screen ---
function LoadingScreen({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #000005 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 0.8s ease-out',
        fontFamily: 'monospace',
      }}
    >
      {/* Animated star dots */}
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 40 }}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: 4 + (i % 3) * 2,
              height: 4 + (i % 3) * 2,
              borderRadius: '50%',
              background: ['#aaccff', '#ffdd88', '#ff88cc', '#88ffcc'][i % 4],
              transform: `rotate(${i * 45}deg) translateX(${40 + (i % 2) * 10}px)`,
              animation: `orbitPulse ${1.2 + i * 0.15}s ease-in-out infinite alternate`,
              boxShadow: `0 0 8px currentColor`,
            }}
          />
        ))}
        {/* Core glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 20, height: 20, borderRadius: '50%',
          background: 'radial-gradient(circle, #ffffff 0%, #8899ff 60%, transparent 100%)',
          animation: 'corePulse 1.5s ease-in-out infinite',
        }} />
      </div>

      <p style={{ color: '#aaaacc', fontSize: 11, letterSpacing: '0.3em', marginBottom: 6, textTransform: 'uppercase', opacity: 0.7 }}>Memory Album</p>
      <p style={{ color: '#ffffff', fontSize: 14, letterSpacing: '0.15em', marginBottom: 32, textTransform: 'uppercase' }}>Initiating Memory Warp...</p>

      {/* Progress bar */}
      <div style={{ width: 200, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'linear-gradient(90deg, #4466ff, #aa44ff, #ff44aa)',
          animation: 'loadingBar 1.4s ease-out forwards',
        }} />
      </div>

      <style>{`
        @keyframes orbitPulse { from { opacity: 0.3; } to { opacity: 1; } }
        @keyframes corePulse { 0%,100% { transform: translate(-50%,-50%) scale(1); opacity:0.8; }
          50% { transform: translate(-50%,-50%) scale(1.4); opacity:1; } }
        @keyframes loadingBar { from { width: 0; } to { width: 100%; } }
      `}</style>
    </div>
  );
}

// --- Gallery Page ---
export default function GalleryPage() {
  const [galaxyLoading, setGalaxyLoading] = useState(false);
  const [level, setLevel] = useState<ViewLevel>('universe');
  const [activeGalaxyId, setActiveGalaxyId] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const activeGalaxy = useMemo(() =>
    GALAXIES.find(g => g.id === activeGalaxyId) || null
    , [activeGalaxyId]);

  const activePhoto = useMemo(() =>
    activeGalaxy?.photos.find(p => p.id === activePhotoId) || null
    , [activeGalaxy, activePhotoId]);

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#020205", overflow: "hidden", position: "relative" }}>
      <Canvas
        camera={{ position: [0, 0, 40], fov: 45 }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
      >
        <Scene
          level={level}
          setLevel={setLevel}
          activeGalaxyId={activeGalaxyId}
          setActiveGalaxyId={setActiveGalaxyId}
          activeGalaxy={activeGalaxy}
          activePhotoId={activePhotoId}
          setActivePhotoId={setActivePhotoId}
          onGalaxyEnter={() => setGalaxyLoading(true)}
          onClusterReady={() => setGalaxyLoading(false)}
        />
      </Canvas>

      {/* ── Fixed HTML Overlays (outside Canvas, always visible) ── */}

      {/* Back button */}
      {level !== 'universe' && (
        <button
          onClick={() => {
            if (level === 'photo') {
              setLevel('cluster');
              setActivePhotoId(null);
            } else {
              setLevel('universe');
              setActiveGalaxyId(null);
            }
          }}
          style={{ position: 'fixed', top: 32, left: 32, zIndex: 100 }}
          className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm backdrop-blur-md border border-white/20 transition-all font-medium shadow-lg"
        >
          ← {level === 'photo' ? 'Back' : 'Universe'}
        </button>
      )}

      {/* Photo Detail Panel — bottom-right, always on top, never touches the photo */}
      {level === 'photo' && activePhoto && (
        <div
          style={{ position: 'fixed', right: 24, bottom: 40, width: 260, zIndex: 100 }}
        >
          <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl text-white">
            <span className="inline-block px-2 py-0.5 bg-white/10 rounded-full text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">{activePhoto.date}</span>
            <h2 className="text-base font-semibold text-white leading-snug mb-2">{activePhoto.title}</h2>
            <div className="h-px w-full bg-gradient-to-r from-white/15 to-transparent mb-3" />
            <p className="text-zinc-400 text-xs leading-relaxed">{activePhoto.description}</p>
          </div>

          {/* Prev / Next navigation */}
          {activeGalaxy && (
            <div className="flex gap-2 mt-3">
              <button
                disabled={activeGalaxy.photos.findIndex(p => p.id === activePhotoId) === 0}
                onClick={() => {
                  const idx = activeGalaxy.photos.findIndex(p => p.id === activePhotoId);
                  if (idx > 0) setActivePhotoId(activeGalaxy.photos[idx - 1].id);
                }}
                className="flex-1 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <button
                disabled={activeGalaxy.photos.findIndex(p => p.id === activePhotoId) === activeGalaxy.photos.length - 1}
                onClick={() => {
                  const idx = activeGalaxy.photos.findIndex(p => p.id === activePhotoId);
                  if (idx < activeGalaxy.photos.length - 1) setActivePhotoId(activeGalaxy.photos[idx + 1].id);
                }}
                className="flex-1 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
      {/* Loading Screen — shows when clicking into a galaxy while photos load */}
      <LoadingScreen visible={galaxyLoading} />
    </div>
  );
}
