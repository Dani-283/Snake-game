import { Position, Direction, PlayerState } from '../types'
import { 
  GRID_WIDTH, 
  GRID_HEIGHT,
  MP_GRID_WIDTH,
  MP_GRID_HEIGHT,
  MP_P1_INITIAL_SNAKE,
  MP_P1_INITIAL_DIRECTION,
  MP_P2_INITIAL_SNAKE,
  MP_P2_INITIAL_DIRECTION,
  MP_FOOD_COUNT,
} from '../constants'

/**
 * Check if two directions are opposite (would cause 180° turn)
 */
export const isOppositeDirection = (dir1: Direction, dir2: Direction): boolean => {
  return dir1.x === -dir2.x && dir1.y === -dir2.y
}

/**
 * Check if two positions are equal
 */
export const positionsEqual = (a: Position, b: Position): boolean => {
  return a.x === b.x && a.y === b.y
}

/**
 * Move the snake in the given direction
 * Returns new snake array with head moved, tail optionally removed
 * @param snake Current snake segments (head first)
 * @param direction Direction to move
 * @param grow If true, don't remove tail (snake grows)
 */
export const moveSnake = (
  snake: Position[],
  direction: Direction,
  grow: boolean = false
): Position[] => {
  const head = snake[0]
  const newHead: Position = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  }
  
  // Add new head at front
  const newSnake = [newHead, ...snake]
  
  // Remove tail unless growing
  if (!grow) {
    newSnake.pop()
  }
  
  return newSnake
}

/**
 * Check if the snake head collides with a wall
 */
export const checkWallCollision = (head: Position): boolean => {
  return (
    head.x < 0 ||
    head.x >= GRID_WIDTH ||
    head.y < 0 ||
    head.y >= GRID_HEIGHT
  )
}

/**
 * Check if the snake head collides with its own body
 * @param snake Snake segments (head first)
 */
export const checkSelfCollision = (snake: Position[]): boolean => {
  const head = snake[0]
  // Check against all body segments (skip head at index 0)
  for (let i = 1; i < snake.length; i++) {
    if (positionsEqual(head, snake[i])) {
      return true
    }
  }
  return false
}

/**
 * Check if a position is occupied by the snake
 */
export const isPositionOccupied = (pos: Position, snake: Position[]): boolean => {
  return snake.some(segment => positionsEqual(pos, segment))
}

/**
 * Spawn food at a random empty cell
 * Uses O(n) build + O(1) pick algorithm to avoid infinite loops
 * @param snake Current snake positions to avoid
 */
export const spawnFood = (snake: Position[]): Position => {
  // Collect all empty cells
  const emptyCells: Position[] = []
  
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const pos = { x, y }
      if (!isPositionOccupied(pos, snake)) {
        emptyCells.push(pos)
      }
    }
  }
  
  // Pick random empty cell
  // If no empty cells (snake fills grid), return invalid position
  // This shouldn't happen in normal gameplay
  if (emptyCells.length === 0) {
    return { x: -1, y: -1 }
  }
  
  const randomIndex = Math.floor(Math.random() * emptyCells.length)
  return emptyCells[randomIndex]
}

/**
 * Create a deep copy of snake positions
 */
export const cloneSnake = (snake: Position[]): Position[] => {
  return snake.map(pos => ({ ...pos }))
}

/**
 * Create initial game state
 */
export const createInitialSnake = (): Position[] => {
  return [
    { x: 15, y: 10 }, // Head
    { x: 14, y: 10 },
    { x: 13, y: 10 }, // Tail
  ]
}

// ===========================================
// MULTIPLAYER Game Functions
// ===========================================

/**
 * Check if the snake head collides with a wall (multiplayer grid)
 */
export const checkWallCollisionMP = (head: Position): boolean => {
  return (
    head.x < 0 ||
    head.x >= MP_GRID_WIDTH ||
    head.y < 0 ||
    head.y >= MP_GRID_HEIGHT
  )
}

/**
 * Check if two snakes collide with each other
 * Returns true if any part of snake1 touches any part of snake2
 */
export const checkSnakeCollision = (snake1: Position[], snake2: Position[]): boolean => {
  const head1 = snake1[0]
  const head2 = snake2[0]
  
  // Head-to-head collision
  if (positionsEqual(head1, head2)) {
    return true
  }
  
  // Head1 hits body2
  for (let i = 0; i < snake2.length; i++) {
    if (positionsEqual(head1, snake2[i])) {
      return true
    }
  }
  
  // Head2 hits body1
  for (let i = 0; i < snake1.length; i++) {
    if (positionsEqual(head2, snake1[i])) {
      return true
    }
  }
  
  return false
}

/**
 * Check if a position is occupied by either snake or existing food
 */
export const isPositionOccupiedMP = (
  pos: Position, 
  snake1: Position[], 
  snake2: Position[],
  existingFood: Position[] = []
): boolean => {
  return snake1.some(s => positionsEqual(pos, s)) ||
         snake2.some(s => positionsEqual(pos, s)) ||
         existingFood.some(f => positionsEqual(pos, f))
}

/**
 * Spawn food using seeded RNG (deterministic across clients)
 * @param rng Seeded random number generator
 * @param snake1 Player 1's snake
 * @param snake2 Player 2's snake
 * @param existingFood Current food positions (to avoid)
 */
export const spawnFoodMP = (
  rng: () => number,
  snake1: Position[],
  snake2: Position[],
  existingFood: Position[] = []
): Position => {
  // Collect all empty cells in deterministic order
  const emptyCells: Position[] = []
  
  for (let y = 0; y < MP_GRID_HEIGHT; y++) {
    for (let x = 0; x < MP_GRID_WIDTH; x++) {
      const pos = { x, y }
      if (!isPositionOccupiedMP(pos, snake1, snake2, existingFood)) {
        emptyCells.push(pos)
      }
    }
  }
  
  // If no empty cells, return invalid position
  if (emptyCells.length === 0) {
    return { x: -1, y: -1 }
  }
  
  // Use seeded RNG for deterministic selection
  const randomIndex = Math.floor(rng() * emptyCells.length)
  return emptyCells[randomIndex]
}

/**
 * Spawn multiple food items for multiplayer
 */
export const spawnInitialFoodMP = (
  rng: () => number,
  snake1: Position[],
  snake2: Position[]
): Position[] => {
  const food: Position[] = []
  
  for (let i = 0; i < MP_FOOD_COUNT; i++) {
    const newFood = spawnFoodMP(rng, snake1, snake2, food)
    if (newFood.x >= 0) {
      food.push(newFood)
    }
  }
  
  return food
}

/**
 * Create initial player state for multiplayer
 */
export const createInitialPlayerState = (playerId: 'player1' | 'player2'): PlayerState => {
  const isPlayer1 = playerId === 'player1'
  return {
    snake: isPlayer1 
      ? MP_P1_INITIAL_SNAKE.map(p => ({ ...p }))
      : MP_P2_INITIAL_SNAKE.map(p => ({ ...p })),
    direction: isPlayer1 ? { ...MP_P1_INITIAL_DIRECTION } : { ...MP_P2_INITIAL_DIRECTION },
    pendingDirection: null,
    score: 0,
    hungerTicks: 0,
    isAlive: true,
  }
}

/**
 * Process starvation for a player
 * Returns updated player state
 * @param player Current player state
 * @param starvationTicks Number of ticks until starvation
 */
export const processStarvation = (
  player: PlayerState,
  starvationTicks: number
): PlayerState => {
  if (!player.isAlive) return player
  
  const newHungerTicks = player.hungerTicks + 1
  
  if (newHungerTicks >= starvationTicks) {
    // Time to shrink
    if (player.snake.length <= 1) {
      // Death by starvation
      return {
        ...player,
        hungerTicks: 0,
        isAlive: false,
      }
    }
    
    // Shrink snake (remove tail)
    return {
      ...player,
      snake: player.snake.slice(0, -1),
      hungerTicks: 0, // Reset after shrink
    }
  }
  
  return {
    ...player,
    hungerTicks: newHungerTicks,
  }
}

/**
 * Check if player's head is on any food
 * Returns the index of eaten food, or -1 if none
 */
export const checkFoodCollision = (head: Position, food: Position[]): number => {
  for (let i = 0; i < food.length; i++) {
    if (positionsEqual(head, food[i])) {
      return i
    }
  }
  return -1
}

/**
 * Get starvation ticks based on current game speed
 * @param speedMs Current tick speed in milliseconds
 */
export const getStarvationTicks = (speedMs: number): number => {
  // 15 seconds worth of ticks
  return Math.ceil(15000 / speedMs)
}

/**
 * Get hunger percentage (0-1) for display
 */
export const getHungerPercentage = (hungerTicks: number, starvationTicks: number): number => {
  return Math.max(0, 1 - (hungerTicks / starvationTicks))
}

/**
 * Check if player should be flashing (last 3 seconds)
 */
export const shouldFlashHunger = (hungerTicks: number, starvationTicks: number, speedMs: number): boolean => {
  const warningTicks = Math.ceil(3000 / speedMs)
  return hungerTicks >= (starvationTicks - warningTicks)
}
