import { useRef, useState, useCallback, useEffect } from 'react'
import { 
  Position, 
  Direction, 
  PlayerState, 
  MultiplayerStatus,
  GameWinner,
  NetworkMessage,
  TickInputMessage,
  PlayerId,
} from '../types'
import {
  KEY_TO_DIRECTION,
  getSpeed,
  LOCKSTEP_TIMEOUT_MS,
} from '../constants'
import {
  moveSnake,
  checkWallCollisionMP,
  checkSelfCollision,
  checkSnakeCollision,
  checkFoodCollision,
  spawnFoodMP,
  spawnInitialFoodMP,
  createInitialPlayerState,
  processStarvation,
  getStarvationTicks,
  getHungerPercentage,
  shouldFlashHunger,
  isOppositeDirection,
} from '../utils/game'
import { createRNG, generateSeed } from '../utils/random'

interface UseMultiplayerGameLoopOptions {
  isHost: boolean
  playerId: PlayerId
  sendMessage: (message: NetworkMessage) => void
  onGameOver: (winner: GameWinner, p1Score: number, p2Score: number) => void
}

interface UseMultiplayerGameLoopReturn {
  // State
  player1: PlayerState
  player2: PlayerState
  food: Position[]
  status: MultiplayerStatus
  level: number
  tick: number
  
  // Ready state
  localReady: boolean
  remoteReady: boolean
  countdown: number | null
  
  // Hunger display
  p1HungerPercent: number
  p2HungerPercent: number
  p1ShouldFlash: boolean
  p2ShouldFlash: boolean
  
  // Actions
  startGame: (seed?: number) => void
  setLocalReady: (ready: boolean) => void
  handleMessage: (message: NetworkMessage) => void
  resetGame: () => void
  
  // Getters
  getPlayer1Snake: () => Position[]
  getPlayer2Snake: () => Position[]
  getFood: () => Position[]
}

export function useMultiplayerGameLoop(
  options: UseMultiplayerGameLoopOptions
): UseMultiplayerGameLoopReturn {
  const { isHost, playerId, sendMessage, onGameOver } = options
  
  // React state (triggers re-renders for UI)
  const [player1, setPlayer1] = useState<PlayerState>(() => createInitialPlayerState('player1'))
  const [player2, setPlayer2] = useState<PlayerState>(() => createInitialPlayerState('player2'))
  const [food, setFood] = useState<Position[]>([])
  const [status, setStatus] = useState<MultiplayerStatus>('ready')
  const [level, setLevel] = useState(1)
  const [tick, setTick] = useState(0)
  
  // Ready state
  const [localReady, setLocalReadyState] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  
  // Hunger display
  const [p1HungerPercent, setP1HungerPercent] = useState(1)
  const [p2HungerPercent, setP2HungerPercent] = useState(1)
  const [p1ShouldFlash, setP1ShouldFlash] = useState(false)
  const [p2ShouldFlash, setP2ShouldFlash] = useState(false)
  
  // Refs for game loop state (no re-renders)
  const gameStateRef = useRef({
    player1: createInitialPlayerState('player1'),
    player2: createInitialPlayerState('player2'),
    food: [] as Position[],
    tick: 0,
    seed: 0,
    rng: null as (() => number) | null,
    accumulatedTime: 0,
    lastTimestamp: 0,
    localDirection: null as Direction | null,
    inputProcessedThisTick: false,
    waitingForRemoteInput: false,
    remoteInputs: new Map<number, Direction | null>(),
    lockstepTimeout: null as number | null,
  })
  
  const statusRef = useRef<MultiplayerStatus>('ready')
  const animationFrameRef = useRef<number>(0)
  const countdownIntervalRef = useRef<number | null>(null)
  const countdownStartedRef = useRef(false)
  
  // Update status ref when state changes
  useEffect(() => {
    statusRef.current = status
  }, [status])
  
  // Get current speed based on combined score
  const getCurrentSpeed = useCallback(() => {
    const state = gameStateRef.current
    const combinedScore = state.player1.score + state.player2.score
    const currentLevel = Math.min(5, Math.floor(combinedScore / 10) + 1)
    return getSpeed(currentLevel)
  }, [])
  
  // Reset game state
  const resetGameState = useCallback(() => {
    const state = gameStateRef.current
    state.player1 = createInitialPlayerState('player1')
    state.player2 = createInitialPlayerState('player2')
    state.food = []
    state.tick = 0
    state.accumulatedTime = 0
    state.lastTimestamp = 0
    state.localDirection = null
    state.inputProcessedThisTick = false
    state.waitingForRemoteInput = false
    state.remoteInputs.clear()
    
    setPlayer1(state.player1)
    setPlayer2(state.player2)
    setFood([])
    setTick(0)
    setLevel(1)
    setP1HungerPercent(1)
    setP2HungerPercent(1)
    setP1ShouldFlash(false)
    setP2ShouldFlash(false)
  }, [])
  
  // Process a single game tick
  const processTick = useCallback(() => {
    const state = gameStateRef.current
    if (!state.rng) return
    
    const currentTick = state.tick
    const speed = getCurrentSpeed()
    const starvationTicks = getStarvationTicks(speed)
    
    // Get inputs for this tick
    const localInput = state.localDirection
    const remoteInput = state.remoteInputs.get(currentTick) ?? null
    
    // Determine which input is P1 and which is P2
    const p1Input = playerId === 'player1' ? localInput : remoteInput
    const p2Input = playerId === 'player2' ? localInput : remoteInput
    
    // 1. Apply pending directions (P1 first, then P2)
    if (p1Input && state.player1.isAlive) {
      if (!isOppositeDirection(p1Input, state.player1.direction)) {
        state.player1.direction = p1Input
      }
    }
    if (p2Input && state.player2.isAlive) {
      if (!isOppositeDirection(p2Input, state.player2.direction)) {
        state.player2.direction = p2Input
      }
    }
    
    // Reset local input
    state.localDirection = null
    state.inputProcessedThisTick = false
    
    // 2. Move snakes
    // Move P1
    if (state.player1.isAlive) {
      state.player1.snake = moveSnake(state.player1.snake, state.player1.direction, false)
    }
    
    // Move P2
    if (state.player2.isAlive) {
      state.player2.snake = moveSnake(state.player2.snake, state.player2.direction, false)
    }
    
    // 3-4. Check wall collisions
    if (state.player1.isAlive && checkWallCollisionMP(state.player1.snake[0])) {
      state.player1.isAlive = false
    }
    if (state.player2.isAlive && checkWallCollisionMP(state.player2.snake[0])) {
      state.player2.isAlive = false
    }
    
    // 5-6. Check self collisions
    if (state.player1.isAlive && checkSelfCollision(state.player1.snake)) {
      state.player1.isAlive = false
    }
    if (state.player2.isAlive && checkSelfCollision(state.player2.snake)) {
      state.player2.isAlive = false
    }
    
    // 7. Check snake-to-snake collision (both die)
    if (state.player1.isAlive && state.player2.isAlive) {
      if (checkSnakeCollision(state.player1.snake, state.player2.snake)) {
        state.player1.isAlive = false
        state.player2.isAlive = false
      }
    }
    
    // 8. Process starvation
    if (state.player1.isAlive) {
      state.player1 = processStarvation(state.player1, starvationTicks)
    }
    if (state.player2.isAlive) {
      state.player2 = processStarvation(state.player2, starvationTicks)
    }
    
    // 9-10. Check food collisions and handle eating
    // Check BOTH collisions first before modifying food array
    const p1FoodIndex = state.player1.isAlive ? checkFoodCollision(state.player1.snake[0], state.food) : -1
    const p2FoodIndex = state.player2.isAlive ? checkFoodCollision(state.player2.snake[0], state.food) : -1
    
    // Collect food indices to remove (sorted high to low to avoid index shifting)
    const foodToRemove: number[] = []
    if (p1FoodIndex >= 0) foodToRemove.push(p1FoodIndex)
    if (p2FoodIndex >= 0 && p2FoodIndex !== p1FoodIndex) foodToRemove.push(p2FoodIndex)
    foodToRemove.sort((a, b) => b - a)  // Sort descending
    
    // Process P1 eating
    if (p1FoodIndex >= 0) {
      const tail = state.player1.snake[state.player1.snake.length - 1]
      state.player1.snake.push({ ...tail })
      state.player1.score += 1
      state.player1.hungerTicks = 0
    }
    
    // Process P2 eating
    if (p2FoodIndex >= 0) {
      const tail = state.player2.snake[state.player2.snake.length - 1]
      state.player2.snake.push({ ...tail })
      state.player2.score += 1
      state.player2.hungerTicks = 0
    }
    
    // Remove eaten food (from high to low index to avoid shifting)
    for (const index of foodToRemove) {
      state.food.splice(index, 1)
    }
    
    // Spawn new food for each removed food
    for (let i = 0; i < foodToRemove.length; i++) {
      const newFood = spawnFoodMP(state.rng, state.player1.snake, state.player2.snake, state.food)
      if (newFood.x >= 0) {
        state.food.push(newFood)
      }
    }
    
    // 11. Check for game over
    const p1Dead = !state.player1.isAlive
    const p2Dead = !state.player2.isAlive
    
    if (p1Dead || p2Dead) {
      let winner: GameWinner
      
      if (p1Dead && p2Dead) {
        // Both died - higher score wins
        if (state.player1.score > state.player2.score) {
          winner = 'player1'
        } else if (state.player2.score > state.player1.score) {
          winner = 'player2'
        } else {
          winner = 'draw'
        }
      } else if (p1Dead) {
        winner = 'player2'
      } else {
        winner = 'player1'
      }
      
      setStatus('gameover')
      statusRef.current = 'gameover'
      onGameOver(winner, state.player1.score, state.player2.score)
      return
    }
    
    // Update tick counter
    state.tick += 1
    
    // Update level based on combined score
    const combinedScore = state.player1.score + state.player2.score
    const newLevel = Math.min(5, Math.floor(combinedScore / 10) + 1)
    
    // Update React state for rendering
    setPlayer1({ ...state.player1 })
    setPlayer2({ ...state.player2 })
    setFood([...state.food])
    setTick(state.tick)
    setLevel(newLevel)
    
    // Update hunger display
    setP1HungerPercent(getHungerPercentage(state.player1.hungerTicks, starvationTicks))
    setP2HungerPercent(getHungerPercentage(state.player2.hungerTicks, starvationTicks))
    setP1ShouldFlash(shouldFlashHunger(state.player1.hungerTicks, starvationTicks, speed))
    setP2ShouldFlash(shouldFlashHunger(state.player2.hungerTicks, starvationTicks, speed))
    
    // Clean up old remote inputs
    state.remoteInputs.delete(currentTick)
  }, [getCurrentSpeed, onGameOver, playerId])
  
  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    const state = gameStateRef.current
    
    if (statusRef.current !== 'playing') {
      animationFrameRef.current = requestAnimationFrame(gameLoop)
      return
    }
    
    // Calculate delta time
    let deltaTime = timestamp - state.lastTimestamp
    state.lastTimestamp = timestamp
    
    // Cap delta time to prevent issues when tab was backgrounded
    const speed = getCurrentSpeed()
    deltaTime = Math.min(deltaTime, speed)
    
    state.accumulatedTime += deltaTime
    
    // Check if we have remote input for current tick
    const hasRemoteInput = state.remoteInputs.has(state.tick)
    
    if (!hasRemoteInput) {
      // Waiting for remote input - check timeout
      if (!state.waitingForRemoteInput) {
        state.waitingForRemoteInput = true
        state.lockstepTimeout = window.setTimeout(() => {
          // Timeout - opponent disconnected
          if (statusRef.current === 'playing') {
            const winner = playerId === 'player1' ? 'player1' : 'player2'
            setStatus('gameover')
            onGameOver(winner, state.player1.score, state.player2.score)
          }
        }, LOCKSTEP_TIMEOUT_MS)
      }
      
      animationFrameRef.current = requestAnimationFrame(gameLoop)
      return
    }
    
    // Clear timeout if we were waiting
    if (state.lockstepTimeout) {
      clearTimeout(state.lockstepTimeout)
      state.lockstepTimeout = null
      state.waitingForRemoteInput = false
    }
    
    // Process tick when enough time accumulated
    while (state.accumulatedTime >= speed && statusRef.current === 'playing') {
      // Send our input for next tick
      const inputMessage: TickInputMessage = {
        type: 'tick_input',
        tick: state.tick + 1,
        direction: state.localDirection,
      }
      sendMessage(inputMessage)
      
      processTick()
      state.accumulatedTime -= speed
      
      // Check if we need remote input for next tick
      if (!state.remoteInputs.has(state.tick)) {
        break
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(gameLoop)
  }, [getCurrentSpeed, onGameOver, playerId, processTick, sendMessage])
  
  // Handle incoming network messages
  const handleMessage = useCallback((message: NetworkMessage) => {
    const state = gameStateRef.current
    
    switch (message.type) {
      case 'player_ready':
        setRemoteReady(message.ready)
        break
        
      case 'game_start':
        // Initialize game with shared seed
        state.seed = message.seed
        state.rng = createRNG(message.seed)
        state.player1 = createInitialPlayerState('player1')
        state.player2 = createInitialPlayerState('player2')
        state.food = spawnInitialFoodMP(state.rng, state.player1.snake, state.player2.snake)
        state.tick = 0
        state.accumulatedTime = 0
        state.lastTimestamp = performance.now()
        state.remoteInputs.clear()
        
        // Set initial "no input" for tick 0
        state.remoteInputs.set(0, null)
        
        setPlayer1({ ...state.player1 })
        setPlayer2({ ...state.player2 })
        setFood([...state.food])
        setTick(0)
        setLevel(1)
        setStatus('playing')
        statusRef.current = 'playing'
        break
        
      case 'tick_input':
        // Store remote input for the specified tick
        state.remoteInputs.set(message.tick, message.direction)
        break
        
      case 'rematch_request':
        // Handle rematch request
        break
        
      case 'rematch_accept':
        // Handle rematch accept
        break
    }
  }, [])
  
  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const state = gameStateRef.current
    
    // Prevent default for game keys
    if (KEY_TO_DIRECTION[e.key] || e.key === ' ') {
      e.preventDefault()
    }
    
    // Only handle input during playing state
    if (statusRef.current !== 'playing') return
    
    const newDirection = KEY_TO_DIRECTION[e.key]
    if (!newDirection) return
    
    // Only accept one input per tick
    if (state.inputProcessedThisTick) return
    
    // Get current direction for our player
    const myPlayer = playerId === 'player1' ? state.player1 : state.player2
    
    // Don't allow 180 turns
    if (!isOppositeDirection(newDirection, myPlayer.direction)) {
      state.localDirection = newDirection
      state.inputProcessedThisTick = true
    }
  }, [playerId])
  
  // Set local ready state
  const setLocalReady = useCallback((ready: boolean) => {
    setLocalReadyState(ready)
    sendMessage({ type: 'player_ready', ready })
  }, [sendMessage])
  
  // Start the game (host only)
  const startGame = useCallback((providedSeed?: number) => {
    const seed = providedSeed ?? generateSeed()
    const state = gameStateRef.current
    
    state.seed = seed
    state.rng = createRNG(seed)
    state.player1 = createInitialPlayerState('player1')
    state.player2 = createInitialPlayerState('player2')
    state.food = spawnInitialFoodMP(state.rng, state.player1.snake, state.player2.snake)
    state.tick = 0
    state.accumulatedTime = 0
    state.lastTimestamp = performance.now()
    state.remoteInputs.clear()
    
    // Set initial "no input" for tick 0
    state.remoteInputs.set(0, null)
    
    // Send game start message to peer
    sendMessage({
      type: 'game_start',
      seed,
      timestamp: Date.now(),
    })
    
    setPlayer1({ ...state.player1 })
    setPlayer2({ ...state.player2 })
    setFood([...state.food])
    setTick(0)
    setLevel(1)
    setStatus('playing')
    statusRef.current = 'playing'
  }, [sendMessage])
  
  // Reset game
  const resetGame = useCallback(() => {
    resetGameState()
    setStatus('ready')
    statusRef.current = 'ready'
    setLocalReadyState(false)
    setRemoteReady(false)
    setCountdown(null)
    countdownStartedRef.current = false
  }, [resetGameState])
  
  // Start countdown when both players ready
  useEffect(() => {
    if (localReady && remoteReady && status === 'ready' && !countdownStartedRef.current) {
      countdownStartedRef.current = true
      setCountdown(3)
      setStatus('countdown')
      
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
              countdownIntervalRef.current = null
            }
            // Host starts the game
            if (isHost) {
              startGame()
            }
            return null
          }
          return prev - 1
        })
      }, 1000)
    }
  }, [localReady, remoteReady, status, isHost, startGame])
  
  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [])
  
  // Set up game loop and keyboard listeners
  useEffect(() => {
    gameStateRef.current.lastTimestamp = performance.now()
    animationFrameRef.current = requestAnimationFrame(gameLoop)
    
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current)
      window.removeEventListener('keydown', handleKeyDown)
      
      if (gameStateRef.current.lockstepTimeout) {
        clearTimeout(gameStateRef.current.lockstepTimeout)
      }
    }
  }, [gameLoop, handleKeyDown])
  
  // Getters for rendering
  const getPlayer1Snake = useCallback(() => gameStateRef.current.player1.snake, [])
  const getPlayer2Snake = useCallback(() => gameStateRef.current.player2.snake, [])
  const getFood = useCallback(() => gameStateRef.current.food, [])
  
  return {
    player1,
    player2,
    food,
    status,
    level,
    tick,
    localReady,
    remoteReady,
    countdown,
    p1HungerPercent,
    p2HungerPercent,
    p1ShouldFlash,
    p2ShouldFlash,
    startGame,
    setLocalReady,
    handleMessage,
    resetGame,
    getPlayer1Snake,
    getPlayer2Snake,
    getFood,
  }
}
