# Floating Memories 🌌

An interactive 3D photo gallery built with Three.js and React Three Fiber. Your memories floating in space.

## Preview Concept

The gallery simulates photos floating in zero gravity, allowing users to explore memories in a spatial and interactive way.

Cards gently drift and rotate in space.
When a card is clicked, it moves forward and flips to reveal additional information.

## Features

- 🎴 Interactive 3D photo cards floating in space
- 🖱️ Mouse-responsive camera movement
- ✨ Smooth animations and transitions
- 🎨 Beautiful lighting and particle effects
- 📱 Responsive design

## Tech Stack

- **Next.js 15** - React framework
- **React Three Fiber** - React renderer for Three.js
- **Three.js** - 3D graphics library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

## Getting Started

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

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Adding Your Photos

1. Place your photos in `/public/photos/` directory
2. Update the photo paths in `app/page.tsx`:
```typescript
const photos = [
  '/photos/photo1.jpg',
  '/photos/photo2.jpg',
  // Add more...
];
```

## Project Structure
```
floating-memories/
├── app/
│   ├── page.tsx          # Main 3D gallery component
│   └── layout.tsx        # App layout
├── public/
│   └── photos/           # Your photo files
├── package.json
└── README.md
```

## Controls

- **Mouse Move**: Camera follows your cursor
- **Click Card**: Bring card forward and flip
- **Scroll**: Zoom in/out (if implemented)

## Customization

You can customize:
- Number of cards
- Card size and spacing
- Animation speed
- Lighting and colors
- Particle effects

Edit values in `app/page.tsx` to experiment!

## Development Notes

Built as a learning project to practice:
- Three.js fundamentals
- React Three Fiber
- 3D transformations and animations
- Interactive 3D experiences
