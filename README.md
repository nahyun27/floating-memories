# 🌌 Floating Memories

> **Your personal memory galaxy. Navigate through the cosmos of your life's moments.**

An immersive 3D interactive photo gallery that transforms your photos into a navigable universe. Each collection of memories becomes a galaxy you can explore, with photos floating as cards in zero gravity.

[![Live Demo](https://img.shields.io/badge/🚀-Live%20Demo-blue?style=for-the-badge)](https://floating-memories.vercel.app)

## ✨ Features

### 🌠 Three-Level Exploration
- **Universe View** → Navigate between memory galaxies in deep space
- **Galaxy View** → Enter a galaxy to see photos floating as 3D cards  
- **Photo Detail** → Focus on individual memories with metadata

### 🎨 Visual Effects
- **Bloom & Post-Processing** - Cinematic glow and depth of field
- **Particle Galaxies** - Each galaxy is made of hundreds of colored particles
- **Spiral Structures** - Galaxies with realistic rotational dynamics
- **Background Stars** - 2000+ ambient stars creating depth
- **Smooth Camera Transitions** - Fluid movement between views

### 🎵 Sound Design
- **Ambient Space Drone** - Layered oscillators for atmosphere
- **Interactive SFX** - Hover hum, warp sounds, and clicks
- **Mute Toggle** - Control audio from the UI

### 🎮 Controls
- **Click** galaxies to enter
- **Click** photos to view details
- **ESC** to go back
- **Arrow Keys** (←/→) navigate between photos
- **Mouse** to look around

## 🛠 Tech Stack

- **[Next.js 15](https://nextjs.org)** - React framework with App Router
- **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber)** - React renderer for Three.js
- **[Three.js](https://threejs.org)** - WebGL 3D library
- **[@react-three/drei](https://github.com/pmndrs/drei)** - Useful helpers for R3F
- **[@react-three/postprocessing](https://github.com/pmndrs/postprocessing)** - Post-processing effects
- **[@react-spring/three](https://www.react-spring.dev/)** - Spring animations
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Web Audio API** - Procedural sound generation (no files!)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/floating-memories.git
cd floating-memories

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the magic ✨
