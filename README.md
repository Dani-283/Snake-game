# Snake Game

A classic Snake game built with React and HTML5 Canvas, featuring a retro CRT phosphor aesthetic.

## Overview

This project implements a fully-featured Snake game with:
- Smooth gameplay using `requestAnimationFrame`
- Level progression with increasing speed
- High score persistence via localStorage
- Retro CRT phosphor green visual theme
- Keyboard controls (Arrow keys + WASD)

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| HTML5 Canvas | Game rendering |

## Project Structure

```
snake-game/
├── index.html              # Entry HTML
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
├── spec.md                 # Game specification
├── README.md               # This file
│
└── src/
    ├── main.tsx            # React entry point
    ├── App.tsx             # Root component
    ├── App.css             # Global styles (CRT theme)
    ├── constants.ts        # Game constants (grid, colors, speeds)
    ├── types.ts            # TypeScript interfaces
    │
    ├── components/
    │   └── Game.tsx        # Main game component (Canvas + overlays)
    │
    ├── hooks/
    │   └── useGameLoop.ts  # Game loop, state management, input handling
    │
    └── utils/
        ├── game.ts         # Pure game logic (movement, collision, food spawn)
        └── storage.ts      # localStorage wrapper for high scores
```

## Architecture

### State Management (Hybrid Approach)

- **`useRef`** for game loop state (no re-renders):
  - Snake segments
  - Food position
  - Current direction
  - Accumulated time

- **`useState`** for UI state (triggers re-renders):
  - Score
  - Level
  - High score
  - Game status

### Game Loop

```
requestAnimationFrame callback:
  1. Calculate delta time (capped to prevent teleporting)
  2. Accumulate time
  3. When accumulated >= tick speed:
     - Process input
     - Move snake
     - Check collisions
     - Handle food eating
  4. Render frame
  5. Request next frame
```

## Game Features

### Mechanics
- **Grid**: 30 × 20 cells (600 × 400 pixels)
- **Initial snake**: 3 segments at center, moving right
- **Wall collision**: Game over (no wrap-around)
- **Self collision**: Game over

### Level Progression

| Level | Score | Speed |
|-------|-------|-------|
| 1 | 0-9 | 80ms |
| 2 | 10-19 | 70ms |
| 3 | 20-29 | 60ms |
| 4 | 30-39 | 50ms |
| 5 | 40+ | 40ms |

Level display changes color as you progress (green → yellow → orange → red).

### Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Change direction |
| W/A/S/D | Change direction (alternative) |
| Space | Start game / Pause / Unpause |

### Features
- Auto-pause when tab loses focus
- High score saved to localStorage
- "NEW HIGH SCORE!" celebration on game over

## Running the Game

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Visit `http://localhost:5173` to play.

## Visual Design

The game uses a **CRT phosphor** aesthetic:
- Near-black background (`#0a0a0a`)
- Bright phosphor green (`#33ff33`)
- Subtle grid lines
- Glowing text effects
- Retro "Press Start 2P" pixel font

## Files Overview

| File | Lines | Description |
|------|-------|-------------|
| `constants.ts` | ~70 | Grid dimensions, colors, speed settings, direction vectors |
| `types.ts` | ~40 | TypeScript interfaces for Position, Direction, GameState |
| `game.ts` | ~130 | Pure functions: moveSnake, checkCollision, spawnFood |
| `storage.ts` | ~30 | localStorage get/set with error handling |
| `useGameLoop.ts` | ~230 | Core hook: game loop, input handling, state management |
| `Game.tsx` | ~200 | Canvas rendering, HUD, screen overlays |
| `App.css` | ~170 | CRT theme, level colors, animations |
