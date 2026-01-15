import { useRef, useState, useCallback, useEffect } from 'react'
import { Position, Direction, GameStatus, GameStateRefs } from '../types'
import {
  INITIAL_DIRECTION,
  KEY_TO_DIRECTION,
  getSpeed,
  getLevel,
} from '../constants'
import {
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  spawnFood,
  isOppositeDirection,
  positionsEqual,
  createInitialSnake,
} from '../utils/game'
import { getHighScore, setHighScore } from '../utils/storage'

export const useGameLoop = () => {
  // React state (triggers re-renders for UI)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [highScore, setHighScoreState] = useState(() => getHighScore())
  const [status, setStatus] = useState<GameStatus>('start')
  const [isNewHighScore, setIsNewHighScore] = useState(false)

  // Keep a ref to current status for use in event handlers
  const statusRef = useRef<GameStatus>(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  // Keep a ref to current score for game loop
  const scoreRef = useRef(score)
  useEffect(() => {
    scoreRef.current = score
  }, [score])

  // Refs for game state (mutable, no re-renders)
  const gameStateRef = useRef<GameStateRefs>({
    snake: createInitialSnake(),
    food: { x: 20, y: 10 }, // Initial food position
    direction: INITIAL_DIRECTION,
    pendingDirection: null,
    accumulatedTime: 0,
    lastTimestamp: 0,
    inputProcessedThisTick: false,
  })

  // Ref for animation frame ID (for cleanup)
  const animationFrameRef = useRef<number>(0)

  /**
   * Reset game to initial state (refs only, no state updates)
   */
  const resetGameRefs = useCallback(() => {
    const state = gameStateRef.current
    state.snake = createInitialSnake()
    state.food = spawnFood(state.snake)
    state.direction = INITIAL_DIRECTION
    state.pendingDirection = null
    state.accumulatedTime = 0
    state.lastTimestamp = performance.now()
    state.inputProcessedThisTick = false
  }, [])

  /**
   * Start the game
   */
  const startGame = useCallback(() => {
    resetGameRefs()
    setScore(0)
    setLevel(1)
    setIsNewHighScore(false)
    setStatus('playing')
  }, [resetGameRefs])

  /**
   * Handle game over
   */
  const gameOver = useCallback(() => {
    setStatus('gameover')
    const currentScore = scoreRef.current
    const currentHighScore = getHighScore()
    if (currentScore > currentHighScore) {
      setHighScore(currentScore)
      setHighScoreState(currentScore)
      setIsNewHighScore(true)
    }
  }, [])

  /**
   * Game tick - called when enough time has accumulated
   */
  const tick = useCallback(() => {
    const state = gameStateRef.current

    // Apply pending direction
    if (state.pendingDirection) {
      state.direction = state.pendingDirection
      state.pendingDirection = null
    }

    // Reset input flag for next tick
    state.inputProcessedThisTick = false

    // Check if eating food (before move, check where head will be)
    const head = state.snake[0]
    const nextHead: Position = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    }
    const eating = positionsEqual(nextHead, state.food)

    // Move snake
    state.snake = moveSnake(state.snake, state.direction, eating)

    // Check wall collision
    if (checkWallCollision(state.snake[0])) {
      gameOver()
      return
    }

    // Check self collision
    if (checkSelfCollision(state.snake)) {
      gameOver()
      return
    }

    // Handle eating
    if (eating) {
      const newScore = scoreRef.current + 1
      const newLevel = getLevel(newScore)
      setScore(newScore)
      scoreRef.current = newScore
      setLevel(newLevel)
      state.food = spawnFood(state.snake)
    }
  }, [gameOver])

  /**
   * Main game loop (requestAnimationFrame)
   */
  const gameLoop = useCallback((timestamp: number) => {
    const state = gameStateRef.current
    const currentStatus = statusRef.current

    // Calculate delta time
    let deltaTime = timestamp - state.lastTimestamp
    state.lastTimestamp = timestamp

    // Cap delta time to prevent teleporting after tab was backgrounded
    const currentSpeed = getSpeed(getLevel(scoreRef.current))
    deltaTime = Math.min(deltaTime, currentSpeed)

    // Only accumulate time and tick if playing
    if (currentStatus === 'playing') {
      state.accumulatedTime += deltaTime

      // Tick game logic when enough time accumulated
      while (state.accumulatedTime >= currentSpeed && statusRef.current === 'playing') {
        tick()
        state.accumulatedTime -= currentSpeed
      }
    }

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(gameLoop)
  }, [tick])

  /**
   * Handle keyboard input
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const state = gameStateRef.current
    const currentStatus = statusRef.current

    // Prevent default for game keys to stop page scroll
    if (KEY_TO_DIRECTION[e.key] || e.key === ' ') {
      e.preventDefault()
    }

    // Spacebar handling
    if (e.key === ' ') {
      if (currentStatus === 'start') {
        startGame()
      } else if (currentStatus === 'playing') {
        setStatus('paused')
      } else if (currentStatus === 'paused') {
        // Reset timestamp to avoid huge delta on unpause
        state.lastTimestamp = performance.now()
        state.accumulatedTime = 0
        setStatus('playing')
      }
      return
    }

    // Direction keys
    const newDirection = KEY_TO_DIRECTION[e.key]
    if (newDirection) {
      // Start game on direction key press from start screen
      if (currentStatus === 'start') {
        // Set initial direction based on key pressed (if not opposite to default)
        if (!isOppositeDirection(newDirection, INITIAL_DIRECTION)) {
          state.pendingDirection = newDirection
        }
        startGame()
        return
      }

      // During gameplay, queue direction change
      if (currentStatus === 'playing') {
        // Only accept one input per tick
        if (!state.inputProcessedThisTick) {
          // Check if new direction is opposite to current
          if (!isOppositeDirection(newDirection, state.direction)) {
            state.pendingDirection = newDirection
            state.inputProcessedThisTick = true
          }
        }
      }
    }
  }, [startGame])

  /**
   * Handle visibility change (auto-pause on tab blur)
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && statusRef.current === 'playing') {
      setStatus('paused')
    }
  }, [])

  /**
   * Start the game loop
   */
  useEffect(() => {
    gameStateRef.current.lastTimestamp = performance.now()
    animationFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [gameLoop])

  /**
   * Set up keyboard and visibility listeners
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleKeyDown, handleVisibilityChange])

  /**
   * Expose getters for rendering
   */
  const getSnake = useCallback(() => gameStateRef.current.snake, [])
  const getFood = useCallback(() => gameStateRef.current.food, [])

  return {
    // State
    score,
    level,
    highScore,
    status,
    isNewHighScore,
    // Actions
    startGame,
    // Getters for rendering
    getSnake,
    getFood,
  }
}
