"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture, Text, Html, CameraControls, Image } from "@react-three/drei";
import { EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useSpring, a } from "@react-spring/three";

// --- Web Audio Engine (no external files needed) ---
function createAudio() {
  if (typeof window === 'undefined') return null;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
  } catch { return null; }
}

let _audioCtx: AudioContext | null = null;
function getAudio() {
  if (!_audioCtx) _audioCtx = createAudio();
  return _audioCtx;
}

function playHoverHum(start: boolean) {
  const ctx = getAudio();
  if (!ctx) return undefined;
  try {
    ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 180;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(start ? 0.05 : 0, ctx.currentTime + 0.15);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    if (!start) { gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3); osc.stop(ctx.currentTime + 0.35); }
    return { stop: () => { gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); osc.stop(ctx.currentTime + 0.2); } };
  } catch { return undefined; }
}

function playWarpSound() {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    ctx.resume();
    // Whoosh: freq sweep down
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.7);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    // Low pass to soften
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1200;
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.75);
  } catch { }
}

function playClickSound() {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch { }
}

// Ambient drone: 3 detuned sine oscillators for a space atmosphere hum
let _ambientNodes: { oscs: OscillatorNode[]; masterGain: GainNode } | null = null;

function startAmbient() {
  const ctx = getAudio();
  if (!ctx || _ambientNodes) return;
  try {
    ctx.resume();
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);
    masterGain.connect(ctx.destination);

    const freqs = [55, 110.2, 165.5, 82.4];
    const oscs = freqs.map(f => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.value = f === 55 ? 1 : 0.4;
      osc.connect(g); g.connect(masterGain);
      osc.start();
      return osc;
    });
    _ambientNodes = { oscs, masterGain };
  } catch { }
}

function stopAmbient() {
  if (!_ambientNodes) return;
  try {
    const ctx = getAudio();
    if (ctx) {
      _ambientNodes.masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      setTimeout(() => {
        _ambientNodes?.oscs.forEach(o => { try { o.stop(); } catch { } });
        _ambientNodes = null;
      }, 2000);
    }
  } catch { }
}


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
  rotation?: [number, number, number];
  folder: string;
  photoTitle: string;
  photoDate: string;
  photoDesc: string;
  photos: PhotoMetadata[]; // populated at runtime
}

const MAX_PHOTOS_PER_GALAXY = 8;

// Static metadata — photos are loaded dynamically from /api/photos/{folder}
const GALAXY_CONFIGS: Omit<GalaxyData, 'photos'>[] = [
  {
    id: 'special',
    name: "Special Moments 🎉",
    color: "#ffaa00",
    position: [-22, 8, -10],
    rotation: [0.3, 0.5, 0.2],
    folder: 'special',
    photoTitle: 'Special Moment',
    photoDate: '2025',
    photoDesc: 'Those rare, golden moments that make life extraordinary. Times we want to hold onto forever.',
  },
  {
    id: 'style',
    name: "Style & Looks ✨",
    color: "#00aaff",
    position: [24, -10, -18],
    rotation: [-0.4, -0.3, 0.6],
    folder: 'style',
    photoTitle: 'Style Snapshot',
    photoDate: '2024-2025',
    photoDesc: 'Fashion experiments, new haircuts, and style evolution. Confidence captured.',
  },
  {
    id: 'travel',
    name: "Travel ✈️",
    color: "#aa00ff",
    position: [2, 18, -30],
    rotation: [0.8, -0.2, -0.4],
    folder: 'travel',
    photoTitle: 'Adventure',
    photoDate: 'Dec 2023',
    photoDesc: 'Exploring new places around the world. Every street corner had a story.',
  },
  {
    id: 'cafes',
    name: "Coffee Shops ☕",
    color: "#aa6644",
    position: [-5, -16, -5],
    rotation: [-0.6, 0.7, 0.1],
    folder: 'cafes',
    photoTitle: 'Café Moment',
    photoDate: 'Jan 2024',
    photoDesc: 'Caffeine-fueled adventures. Finding the perfect corner in every city.',
  },
  {
    id: 'food',
    name: "Food & Taste 🍜",
    color: "#88ff44",
    position: [-18, -8, -35],
    rotation: [0.2, 0.9, -0.3],
    folder: 'food',
    photoTitle: 'Delicious Moment',
    photoDate: '2024',
    photoDesc: 'Every meal is a memory. From street food to home cooking, a journey through flavours.',
  },
  {
    id: 'climbing',
    name: "Climbing 🧗",
    color: "#00ccff",
    position: [14, 12, -42],
    rotation: [-0.3, -0.8, 0.5],
    folder: 'climbing',
    photoTitle: 'Summit',
    photoDate: '2024',
    photoDesc: 'Reaching new heights, one hold at a time. The wall, the sweat, and the view from the top.',
  },
  {
    id: 'spring',
    name: "Spring & Sakura 🌸",
    color: "#ffaac8",
    position: [8, -14, -22],
    rotation: [0.5, -0.4, 0.7],
    folder: 'spring',
    photoTitle: 'Blossom',
    photoDate: 'Spring 2024',
    photoDesc: 'Cherry blossoms, warm breezes, and the brief beauty of spring. A season that never lasts long enough.',
  },
  {
    id: 'cooking',
    name: "Cooking 👨‍🍳",
    color: "#ff00aa",
    position: [-30, 14, -20],
    rotation: [-0.2, 0.6, -0.5],
    folder: 'cooking',
    photoTitle: 'Recipe',
    photoDate: '2024',
    photoDesc: 'From prep to plating — the art of turning ingredients into something special.',
  },
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

function BackgroundStars({ count = 2000 }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const coords = new Float32Array(count * 3);
    // Two layers: close faint stars + far dim stars
    for (let i = 0; i < count; i++) {
      const layer = i < count * 0.7 ? 120 : 200;
      coords[i * 3] = (Math.random() - 0.5) * layer;
      coords[i * 3 + 1] = (Math.random() - 0.5) * layer;
      coords[i * 3 + 2] = (Math.random() - 0.5) * layer - 20;
    }
    return coords;
  }, [count]);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.003;
      pointsRef.current.rotation.x += delta * 0.001;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#ffffff" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

// --- Nebula Layer: soft translucent cloud planes ---
const NEBULAE = [
  { color: '#3344ff', pos: [-30, 8, -60] as [number, number, number], scale: [50, 30] },
  { color: '#ff2266', pos: [35, -10, -80] as [number, number, number], scale: [60, 40] },
  { color: '#aa00ff', pos: [0, 20, -70] as [number, number, number], scale: [55, 35] },
  { color: '#00ffaa', pos: [-20, -20, -55] as [number, number, number], scale: [40, 25] },
  { color: '#ff8800', pos: [20, 5, -90] as [number, number, number], scale: [70, 45] },
];

function NebulaLayer() {
  const groupRef = useRef<THREE.Group>(null);

  const nebulaTexture = useMemo(() => {
    // Generate a radial gradient texture for the nebula sprite
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    const cx = size / 2, cy = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / (size * 0.5);
        const alpha = Math.max(0, 1 - dist * dist) * 180;
        const i = (y * size + x) * 4;
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = alpha;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.02) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {NEBULAE.map((n, i) => (
        <mesh key={i} position={n.pos} rotation={[0.1 * i, 0.2 * i, 0]}>
          <planeGeometry args={[n.scale[0], n.scale[1]]} />
          <meshBasicMaterial color={n.color} map={nebulaTexture} transparent opacity={0.07 + (i % 3) * 0.02} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

// --- Shooting Stars ---
function ShootingStars() {
  const linesRef = useRef<(THREE.Line | null)[]>([]);
  const metaRef = useRef<{ active: boolean; t: number; dir: THREE.Vector3; start: THREE.Vector3 }[]>(
    Array.from({ length: 5 }, () => ({ active: false, t: 99, dir: new THREE.Vector3(), start: new THREE.Vector3() }))
  );
  const timerRef = useRef(Math.random() * 4 + 2);

  useFrame((_, delta) => {
    timerRef.current -= delta;
    if (timerRef.current <= 0) {
      // Spawn a shooting star on a random inactive slot
      const slot = metaRef.current.findIndex(m => !m.active);
      if (slot !== -1) {
        const m = metaRef.current[slot];
        m.active = true; m.t = 0;
        m.start.set((Math.random() - 0.5) * 80, (Math.random() * 30) + 10, (Math.random() - 0.5) * 40 - 20);
        m.dir.set(Math.random() * 0.5 - 1, -Math.random() * 0.3 - 0.1, -0.2).normalize();
      }
      timerRef.current = Math.random() * 5 + 2;
    }

    metaRef.current.forEach((m, i) => {
      const line = linesRef.current[i];
      if (!line) return;
      if (!m.active) { line.visible = false; return; }
      m.t += delta * 2.5;
      if (m.t > 1) { m.active = false; line.visible = false; return; }
      line.visible = true;
      const head = m.start.clone().addScaledVector(m.dir, m.t * 25);
      const tail = head.clone().addScaledVector(m.dir, -5);
      const pos = line.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, tail.x, tail.y, tail.z);
      pos.setXYZ(1, head.x, head.y, head.z);
      pos.needsUpdate = true;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.sin(m.t * Math.PI) * 0.9;
    });
  });

  return (
    <>
      {Array.from({ length: 5 }, (_, i) => {
        const posArr = new Float32Array([0, 0, 0, 1, 1, 1]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
        return (
          <primitive
            key={i}
            object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }))}
            ref={(el: THREE.Line | null) => { linesRef.current[i] = el; }}
          />
        );
      })}
    </>
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

// Level 1: A single Galaxy cluster of particles — spiral disc design
function GalaxyParticleCluster({
  galaxy,
  onClick
}: {
  galaxy: GalaxyData;
  onClick: () => void;
}) {
  // Scale everything by photo count: 0 photos = small, 8 = large
  const photoCount = galaxy.photos.length;
  const sizeFactor = 0.5 + Math.min(photoCount / 8, 1) * 0.8; // 0.5 → 1.3
  const count = Math.round(300 + photoCount * 55);             // 300 → 740
  const discRadius = 2.5 + photoCount * 0.2;                  // 2.5 → 4.1
  const coreCount = 40 + photoCount * 8;

  const pointsRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const humRef = useRef<{ stop: () => void } | undefined>(undefined);

  const [positions, colors, corePosArr] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const baseColor = new THREE.Color(galaxy.color);
    const whiteColor = new THREE.Color(0xffffff);
    const corePos = new Float32Array(coreCount * 3);

    for (let i = 0; i < count; i++) {
      const arm = Math.floor(Math.random() * 3);
      const t = Math.pow(Math.random(), 0.7);
      const r = 0.2 + t * discRadius;
      const spiralAngle = t * Math.PI * 5 + (arm / 3) * Math.PI * 2;
      const scatter = (1 - t) * 0.6 + 0.1;
      pos[i * 3] = Math.cos(spiralAngle) * r + (Math.random() - 0.5) * scatter;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5 * (1 - t * 0.7);
      pos[i * 3 + 2] = Math.sin(spiralAngle) * r + (Math.random() - 0.5) * scatter;
      const mixRatio = Math.min(r / discRadius, 1);
      const c = whiteColor.clone().lerp(baseColor, mixRatio * mixRatio);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    for (let i = 0; i < coreCount; i++) {
      const r = Math.pow(Math.random(), 3) * 1.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      corePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      corePos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.4;
      corePos[i * 3 + 2] = r * Math.cos(phi);
    }
    return [pos, col, corePos];
  }, [galaxy.color, count, coreCount, discRadius]);

  const initRot = galaxy.rotation ?? [0, 0, 0];

  useFrame((state, delta) => {
    const speed = hovered ? 0.3 : 0.12;
    if (pointsRef.current) pointsRef.current.rotation.y += delta * speed;
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * speed * 1.6;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.1;
      coreRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.03;
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.04;
      ringRef.current.scale.setScalar(breathe);
    }
  });

  const { scale } = useSpring({
    scale: hovered ? 1.1 * sizeFactor : sizeFactor,
    config: { mass: 1, tension: 200, friction: 50 }
  });

  return (
    <a.group
      position={galaxy.position}
      scale={scale}
      rotation={initRot as [number, number, number]}
    >
      <pointLight position={[0, 0, 0]} intensity={hovered ? 5 : 2.5} color={galaxy.color} distance={discRadius * 4} decay={2} />

      {/* Outer dust ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[discRadius * 0.9, discRadius * 1.35, 64]} />
        <meshBasicMaterial color={galaxy.color} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Core */}
      <points ref={coreRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[corePosArr, 3]} array={corePosArr} count={coreCount} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.22} color="#ffffff" transparent opacity={0.98} sizeAttenuation />
      </points>

      {/* Spiral disc */}
      <points
        ref={pointsRef}
        onClick={(e) => { e.stopPropagation(); playWarpSound(); onClick(); }}
        onPointerOver={(e) => {
          e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer';
          humRef.current = playHoverHum(true) ?? undefined;
        }}
        onPointerOut={() => {
          setHovered(false); document.body.style.cursor = 'auto';
          humRef.current?.stop(); humRef.current = undefined;
        }}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} array={positions} count={count} itemSize={3} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} array={colors} count={count} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.07} vertexColors transparent opacity={hovered ? 1 : 0.82} sizeAttenuation />
      </points>

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
        if (level === 'cluster') { playClickSound(); onCardClick(); }
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
    // Set zoom limits per view level
    if (level === 'universe') {
      controls.minDistance = 15;  // Don't zoom in too close to galaxies
      controls.maxDistance = 80;  // Don't zoom out so far they disappear
    } else if (level === 'cluster') {
      controls.minDistance = 5;   // Stop before entering a card
      controls.maxDistance = 35;  // Stay inside the cluster space
    } else if (level === 'photo') {
      controls.minDistance = 3;   // Can get close to photo
      controls.maxDistance = 22;  // Don't zoom out past photo cluster
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
  galaxies,
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
  galaxies: GalaxyData[];
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
      <ShootingStars />

      {/* Level 1: Universe */}
      {level === 'universe' && galaxies.map((galaxy: GalaxyData) => (
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
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={1.2} />
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
  const [galaxies, setGalaxies] = useState<GalaxyData[]>(() =>
    GALAXY_CONFIGS.map(cfg => ({ ...cfg, photos: [] }))
  );
  const [galaxyLoading, setGalaxyLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState<ViewLevel>('universe');
  const [activeGalaxyId, setActiveGalaxyId] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  // Dynamically load photo filenames from the API on mount
  useEffect(() => {
    Promise.all(
      GALAXY_CONFIGS.map(async (cfg) => {
        try {
          const res = await fetch(`/api/photos/${cfg.folder}`);
          const files: string[] = await res.json();
          const photos: PhotoMetadata[] = files
            .slice(0, MAX_PHOTOS_PER_GALAXY)
            .map((filename, i) => ({
              id: `${cfg.id}-p${i}`,
              url: `/memories/${cfg.folder}/${filename}`,
              title: `${cfg.photoTitle} ${i + 1}`,
              date: cfg.photoDate,
              description: cfg.photoDesc,
            }));
          return { ...cfg, photos };
        } catch {
          return { ...cfg, photos: [] };
        }
      })
    ).then(setGalaxies);
  }, []);

  useEffect(() => {
    if (!muted) { startAmbient(); } else { stopAmbient(); }
    return () => stopAmbient();
  }, [muted]);

  const activeGalaxy = useMemo(() =>
    galaxies.find((g: GalaxyData) => g.id === activeGalaxyId) || null
    , [galaxies, activeGalaxyId]);

  const activePhoto = useMemo(() =>
    activeGalaxy?.photos.find((p: PhotoMetadata) => p.id === activePhotoId) || null
    , [activeGalaxy, activePhotoId]);


  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#020205", overflow: "hidden", position: "relative" }} className="font-[family-name:var(--font-space)]">
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
          galaxies={galaxies}
        />
      </Canvas>

      {/* ── Fixed HTML Overlays (outside Canvas, always visible) ── */}

      {/* Sound toggle — top right */}
      <button
        onClick={() => setMuted(m => !m)}
        style={{ position: 'fixed', top: 28, right: 28, zIndex: 100 }}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 hover:border-white/30 text-white transition-all shadow-xl"
        title={muted ? 'Unmute' : 'Mute'}
      >
        <span style={{ fontSize: 16 }}>{muted ? '🔇' : '🔊'}</span>
      </button>

      {/* Galaxy name header — shown when inside a galaxy */}
      {(level === 'cluster' || level === 'photo') && activeGalaxy && (
        <div style={{ position: 'fixed', top: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <div className="flex items-center gap-2 px-5 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-xl">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeGalaxy.color, boxShadow: `0 0 8px ${activeGalaxy.color}` }} />
            <span className="text-white text-sm font-medium tracking-wide">{activeGalaxy.name}</span>
            <span className="text-white/30 text-xs">{activeGalaxy.photos.length} memories</span>
          </div>
        </div>
      )}

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
