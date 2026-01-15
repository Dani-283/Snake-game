// Position on the grid
export interface Position {
  x: number
  y: number
}

// Direction vectors
export interface Direction {
  x: number
  y: number
}

// Game states
export type GameStatus = 'start' | 'playing' | 'paused' | 'gameover'

// Direction keys mapping
export type DirectionKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'w' | 'a' | 's' | 'd' | 'W' | 'A' | 'S' | 'D'

// Game state stored in refs (mutable, no re-renders)
export interface GameStateRefs {
  snake: Position[]
  food: Position
  direction: Direction
  pendingDirection: Direction | null
  accumulatedTime: number
  lastTimestamp: number
  inputProcessedThisTick: boolean
}

// Game state stored in React state (triggers re-renders)
export interface GameStateReact {
  score: number
  level: number
  highScore: number
  status: GameStatus
  isNewHighScore: boolean
}

// ===========================================
// MULTIPLAYER Types
// ===========================================

// App screen states
export type AppScreen = 
  | 'menu' 
  | 'single-player' 
  | 'multiplayer-lobby'
  | 'multiplayer-waiting'
  | 'multiplayer-connecting'
  | 'multiplayer-ready'
  | 'multiplayer-playing'
  | 'multiplayer-gameover'

// Multiplayer game states
export type MultiplayerStatus = 
  | 'waiting'      // Host waiting for guest
  | 'connecting'   // Guest connecting to host
  | 'ready'        // Both connected, ready screen
  | 'countdown'    // 3-2-1 countdown
  | 'playing'      // Game in progress
  | 'gameover'     // Game ended

// Player identifier
export type PlayerId = 'player1' | 'player2'

// Game result
export type GameWinner = 'player1' | 'player2' | 'draw'

// Connection status
export type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

// ===========================================
// Network Message Types
// ===========================================

export interface TickInputMessage {
  type: 'tick_input'
  tick: number
  direction: Direction | null
}

export interface GameStartMessage {
  type: 'game_start'
  seed: number
  timestamp: number
}

export interface PlayerReadyMessage {
  type: 'player_ready'
  ready: boolean
}

export interface GameResultMessage {
  type: 'game_result'
  winner: GameWinner
  p1Score: number
  p2Score: number
}

export interface RematchRequestMessage {
  type: 'rematch_request'
}

export interface RematchAcceptMessage {
  type: 'rematch_accept'
}

export interface DisconnectMessage {
  type: 'disconnect'
  reason: string
}

export interface PingMessage {
  type: 'ping'
  timestamp: number
}

export interface PongMessage {
  type: 'pong'
  timestamp: number
}

export type NetworkMessage = 
  | TickInputMessage
  | GameStartMessage
  | PlayerReadyMessage
  | GameResultMessage
  | RematchRequestMessage
  | RematchAcceptMessage
  | DisconnectMessage
  | PingMessage
  | PongMessage

// ===========================================
// Multiplayer Game State
// ===========================================

export interface PlayerState {
  snake: Position[]
  direction: Direction
  pendingDirection: Direction | null
  score: number
  hungerTicks: number  // Ticks since last food eaten
  isAlive: boolean
}

export interface MultiplayerGameState {
  player1: PlayerState
  player2: PlayerState
  food: Position[]  // Multiple food items
  tick: number
  level: number
  status: MultiplayerStatus
}

// Multiplayer game state stored in refs
export interface MultiplayerGameStateRefs {
  player1: PlayerState
  player2: PlayerState
  food: Position[]
  tick: number
  seed: number
  rng: () => number  // Seeded random function
  lastTickTime: number
  accumulatedTime: number
  pendingOpponentInput: Map<number, Direction | null>  // tick -> direction
  localInputBuffer: Direction | null
  inputProcessedThisTick: boolean
}

// Result of a multiplayer game
export interface MultiplayerGameResult {
  winner: GameWinner
  p1Score: number
  p2Score: number
  reason: 'death' | 'disconnect' | 'starvation'
}
