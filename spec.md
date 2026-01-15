# Snake Game — Spec

## Overview

A classic Snake game as a single-player web application. The player controls a snake that eats food and grows. The game ends when the snake collides with itself or a wall. Desktop-only, no mobile support.

## Technical Stack

- **Rendering**: HTML5 Canvas
- **Framework**: React
- **State Management**: Hybrid — `useRef` for game loop state (snake, food), React state for UI (score, level, game status)
- **Game Loop**: `requestAnimationFrame` with time accumulation for fixed-timestep movement

## Grid & Dimensions

- **Grid size**: 30 columns × 20 rows (600 cells)
- **Cell size**: 20 × 20 pixels
- **Canvas size**: 600 × 400 pixels
- **Coordinate system**: (0,0) is top-left; x increases right, y increases down

## Visual Design

### Color Palette (CRT Phosphor)
- **Background**: `#0a0a0a` (near-black)
- **Grid lines**: `#1a1a1a` (subtle dark gray, 1px)
- **Snake**: `#33ff33` (bright phosphor green)
- **Food**: `#33ff33` (same green, distinguishable by being single cell)
- **Text/UI**: `#33ff33`

### Snake Appearance
- All segments uniform (same color, same size)
- No head distinction, no gradient

### Grid Lines
- 1px lines between cells
- Color: `#1a1a1a` (barely visible, adds texture)

## Core Mechanics

### Snake
- **Initial state**: 3 segments, head at (15, 10), body extending LEFT: [(15,10), (14,10), (13,10)]
- **Initial direction**: Right (moving away from body)
- **Movement**: Discrete, one cell per tick

### Speed & Levels
- **Base speed**: 80ms per move (Level 1)
- **Speed increase**: -10ms every 10 food eaten
- **Speed cap**: 40ms minimum (Level 5)
- **Level formula**: `level = Math.min(5, Math.floor(score / 10) + 1)`
- **Speed formula**: `speed = Math.max(40, 80 - (level - 1) * 10)`
- **Timing**: Speed change applies on the NEXT tick after threshold crossed

| Level | Score Range | Speed |
|-------|-------------|-------|
| 1     | 0-9         | 80ms  |
| 2     | 10-19       | 70ms  |
| 3     | 20-29       | 60ms  |
| 4     | 30-39       | 50ms  |
| 5     | 40+         | 40ms  |

### Food
- One piece on screen at a time
- **Spawn algorithm**: Collect all empty cells into array, pick random index (O(n) build, O(1) pick — avoids infinite loop when grid is crowded)
- On eat: score +1, snake grows by 1 segment (tail doesn't move this tick), new food spawns

### Collision Detection
- Checked AFTER move completes, BEFORE rendering
- **Wall collision**: Head x < 0, x >= 30, y < 0, or y >= 20 → game over
- **Self collision**: Head occupies same cell as any body segment → game over
- Order: Move → Check collision → Check food → Render

## Input Handling

### Controls
- **Arrow keys**: Change direction (Up/Down/Left/Right)
- **WASD**: Alternative direction keys (W=Up, A=Left, S=Down, D=Right)
- **Spacebar**: Pause/unpause (during gameplay only)
- **All arrow/WASD keys**: `preventDefault()` to stop page scroll

### Input Rules
- **Reverse direction blocked**: Cannot turn 180° (e.g., moving right, pressing left is ignored)
- **One input per tick**: First valid key wins; subsequent keys ignored until next tick
- **Input buffer**: Store pending direction; apply at start of next tick

### State-Specific Input
| State      | Arrow/WASD | Spacebar | Click |
|------------|------------|----------|-------|
| `start`    | Starts game | Starts game | — |
| `playing`  | Change direction | Pause | — |
| `paused`   | — | Unpause | — |
| `gameover` | — | — | "Play Again" button restarts |

## Game States

```
start → playing ⇄ paused
            ↓
        gameover → start (via button)
```

### State Definitions
- **start**: Initial screen, waiting for input
- **playing**: Game loop running, snake moving
- **paused**: Game loop halted, overlay shown, state preserved
- **gameover**: Final screen, shows score/high score, "Play Again" button

## Screens

### Start Screen
- Centered text: "SNAKE"
- Subtext: "Press any arrow key or Space to start"
- High score displayed if exists

### Game Screen (HUD)
- **Top bar**: Score (left), Level (center), High Score (right)
- **Main area**: Canvas with grid, snake, food
- No pause indicator during gameplay (overlay only when paused)

### Pause Overlay
- Semi-transparent dark overlay over canvas
- Centered text: "PAUSED"
- Subtext: "Press Space to continue"

### Game Over Screen
- Overlay on top of final game state (snake visible)
- "GAME OVER"
- Final score, high score (with "NEW!" if beaten)
- "Play Again" button

## Pause Behavior

- **Manual pause**: Spacebar toggles during `playing` state only
- **Auto-pause**: Triggers on `document.visibilitychange` when hidden (tab blur/switch)
- **Auto-pause does NOT trigger** on `gameover` or `start` states
- **Resume**: Only via Spacebar (not auto-resume on tab focus)

## Game Loop Implementation

```
requestAnimationFrame callback:
  1. Calculate deltaTime since last frame
  2. If paused or not playing, skip logic, still render
  3. Accumulate deltaTime
  4. If accumulated >= currentSpeed:
     a. Read pending input, update direction
     b. Move snake (add new head, conditionally remove tail)
     c. Check wall collision → gameover
     d. Check self collision → gameover
     e. Check food collision → eat, grow, spawn food, update score/level
     f. Reset accumulator (subtract currentSpeed, not zero — preserves remainder)
  5. Render frame
  6. Request next frame
```

### Delta Time Capping
- **Problem**: If tab backgrounded, rAF pauses; on return, huge deltaTime
- **Solution**: Cap deltaTime to `currentSpeed` (max 1 tick per frame). Discard excess.

## Persistence

### High Score
- **Storage**: `localStorage.setItem('snakeHighScore', score)`
- **Key**: `snakeHighScore`
- **Read**: On game load, parse as integer, default to 0
- **Write**: On game over, if score > highScore

### Error Handling
- Wrap localStorage access in try/catch
- If unavailable (incognito, quota exceeded): game works, high score doesn't persist
- No user-facing error message; silent degradation

## Error Handling

| Scenario | Handling |
|----------|----------|
| `getContext('2d')` returns null | Show fallback: "Canvas not supported" |
| localStorage throws | Catch silently, disable persistence |
| Tab hidden for long time | Cap delta time, prevent teleporting |
| Window resize | Canvas is fixed size; no responsive handling |

## Out of Scope

- Mobile/touch support
- Sound effects / music
- Win condition (filling entire grid)
- Multiplayer
- Leaderboards / online high scores
- Settings / configuration UI
- Animations / visual effects
