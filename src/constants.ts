import { Direction, Position } from './types'

// ===========================================
// SINGLE PLAYER Grid dimensions
// ===========================================
export const GRID_WIDTH = 30
export const GRID_HEIGHT = 20
export const CELL_SIZE = 20

// Canvas dimensions (derived)
export const CANVAS_WIDTH = GRID_WIDTH * CELL_SIZE  // 600
export const CANVAS_HEIGHT = GRID_HEIGHT * CELL_SIZE // 400

// ===========================================
// MULTIPLAYER Grid dimensions (larger)
// ===========================================
export const MP_GRID_WIDTH = 40
export const MP_GRID_HEIGHT = 30
export const MP_CANVAS_WIDTH = MP_GRID_WIDTH * CELL_SIZE  // 800
export const MP_CANVAS_HEIGHT = MP_GRID_HEIGHT * CELL_SIZE // 600

// ===========================================
// Colors (CRT Phosphor theme for single player)
// ===========================================
export const COLORS = {
  background: '#0a0a0a',
  gridLine: '#1a1a1a',
  snake: '#33ff33',
  food: '#33ff33',
  text: '#33ff33',
} as const

// ===========================================
// Multiplayer Colors
// ===========================================
export const MP_COLORS = {
  background: '#0a0a0a',
  gridLine: '#1a1a1a',
  player1: '#3399ff',  // Blue (host)
  player2: '#ff9933',  // Orange (guest)
  food: '#ffffff',     // White
  text: '#ffffff',
  hungerGreen: '#33ff33',
  hungerYellow: '#ffff33',
  hungerRed: '#ff3333',
} as const

// Speed settings (in milliseconds per move)
export const BASE_SPEED = 80
export const SPEED_DECREASE_PER_LEVEL = 10
export const MIN_SPEED = 40  // Fastest possible (Level 5)
export const FOOD_PER_LEVEL = 10

// Calculate speed from level
export const getSpeed = (level: number): number => {
  return Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_DECREASE_PER_LEVEL)
}

// Calculate level from score
export const getLevel = (score: number): number => {
  return Math.min(5, Math.floor(score / FOOD_PER_LEVEL) + 1)
}

// Direction vectors
export const DIRECTIONS: Record<string, Direction> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
} as const

// Key to direction mapping
export const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: DIRECTIONS.UP,
  ArrowDown: DIRECTIONS.DOWN,
  ArrowLeft: DIRECTIONS.LEFT,
  ArrowRight: DIRECTIONS.RIGHT,
  w: DIRECTIONS.UP,
  W: DIRECTIONS.UP,
  s: DIRECTIONS.DOWN,
  S: DIRECTIONS.DOWN,
  a: DIRECTIONS.LEFT,
  A: DIRECTIONS.LEFT,
  d: DIRECTIONS.RIGHT,
  D: DIRECTIONS.RIGHT,
} as const

// Initial snake position: head at (15, 10), body extends LEFT
export const INITIAL_SNAKE: Position[] = [
  { x: 15, y: 10 }, // Head
  { x: 14, y: 10 },
  { x: 13, y: 10 }, // Tail
]

// Initial direction: moving RIGHT (away from body)
export const INITIAL_DIRECTION: Direction = DIRECTIONS.RIGHT

// localStorage key
export const HIGH_SCORE_KEY = 'snakeHighScore'

// ===========================================
// MULTIPLAYER Spawn positions
// ===========================================

// Player 1 (host) - top-left area, moving right
export const MP_P1_INITIAL_SNAKE: Position[] = [
  { x: 7, y: 7 },   // Head
  { x: 6, y: 7 },
  { x: 5, y: 7 },   // Tail
]
export const MP_P1_INITIAL_DIRECTION: Direction = DIRECTIONS.RIGHT

// Player 2 (guest) - bottom-right area, moving left
export const MP_P2_INITIAL_SNAKE: Position[] = [
  { x: 32, y: 22 }, // Head
  { x: 33, y: 22 },
  { x: 34, y: 22 }, // Tail
]
export const MP_P2_INITIAL_DIRECTION: Direction = DIRECTIONS.LEFT

// ===========================================
// MULTIPLAYER Starvation mechanic
// ===========================================
export const STARVATION_TIME_SECONDS = 15
export const STARVATION_WARNING_SECONDS = 3
// Ticks will be calculated based on current speed:
// At level 1 (80ms): 15s = 187.5 ticks
// At level 5 (40ms): 15s = 375 ticks

// ===========================================
// MULTIPLAYER Food count
// ===========================================
export const MP_FOOD_COUNT = 2

// ===========================================
// MULTIPLAYER Network constants
// ===========================================
export const LOCKSTEP_TIMEOUT_MS = 500
export const CONNECTION_TIMEOUT_MS = 15000  // 15 seconds to allow for slow connections
export const MAX_MESSAGES_PER_SECOND = 30
export const MAX_MESSAGE_SIZE_BYTES = 256
