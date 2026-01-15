import { useRef, useEffect, useCallback, useState } from 'react'
import { 
  PlayerId, 
  GameWinner,
  NetworkMessage,
} from '../types'
import {
  MP_CANVAS_WIDTH,
  MP_CANVAS_HEIGHT,
  CELL_SIZE,
  MP_GRID_WIDTH,
  MP_GRID_HEIGHT,
  MP_COLORS,
} from '../constants'
import { useMultiplayerGameLoop } from '../hooks/useMultiplayerGameLoop'
import ReadyRoom from './ReadyRoom'

interface MultiplayerGameProps {
  isHost: boolean
  playerId: PlayerId
  onGameEnd: () => void
  onDisconnect: () => void
  // Connection props (passed from parent that manages connection)
  sendMessage: (message: NetworkMessage) => void
  latency: number
  // Message handler registration
  registerMessageHandler: (handler: (message: NetworkMessage) => void) => void
}

interface GameOverState {
  winner: GameWinner
  p1Score: number
  p2Score: number
}

const MultiplayerGame = ({
  isHost,
  playerId,
  onGameEnd,
  onDisconnect,
  sendMessage,
  latency,
  registerMessageHandler,
}: MultiplayerGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameOverState, setGameOverState] = useState<GameOverState | null>(null)
  const [showLatency, setShowLatency] = useState(false)

  // Handle game over
  const handleGameOver = useCallback((winner: GameWinner, p1Score: number, p2Score: number) => {
    setGameOverState({ winner, p1Score, p2Score })
  }, [])

  // Game loop hook
  const {
    player1,
    player2,
    status,
    level,
    localReady,
    remoteReady,
    countdown,
    p1HungerPercent,
    p2HungerPercent,
    p1ShouldFlash,
    p2ShouldFlash,
    setLocalReady,
    handleMessage,
    resetGame,
    getPlayer1Snake,
    getPlayer2Snake,
    getFood,
  } = useMultiplayerGameLoop({
    isHost,
    playerId,
    sendMessage,
    onGameOver: handleGameOver,
  })

  // Register message handler with parent
  useEffect(() => {
    registerMessageHandler(handleMessage)
  }, [registerMessageHandler, handleMessage])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle ready with space (during ready phase)
      if (e.key === ' ' && status === 'ready') {
        e.preventDefault()
        setLocalReady(!localReady)
      }
      
      // Toggle latency display with Ctrl+Shift+L
      if (e.key === 'L' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        setShowLatency(prev => !prev)
      }
      
      // Leave game with Escape
      if (e.key === 'Escape') {
        onDisconnect()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, localReady, setLocalReady, onDisconnect])

  // Render game to canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const snake1 = getPlayer1Snake()
    const snake2 = getPlayer2Snake()
    const foodItems = getFood()
    const now = Date.now()

    // Clear canvas
    ctx.fillStyle = MP_COLORS.background
    ctx.fillRect(0, 0, MP_CANVAS_WIDTH, MP_CANVAS_HEIGHT)

    // Draw grid lines
    ctx.strokeStyle = MP_COLORS.gridLine
    ctx.lineWidth = 1

    // Vertical lines
    for (let x = 0; x <= MP_GRID_WIDTH; x++) {
      ctx.beginPath()
      ctx.moveTo(x * CELL_SIZE, 0)
      ctx.lineTo(x * CELL_SIZE, MP_CANVAS_HEIGHT)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = 0; y <= MP_GRID_HEIGHT; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * CELL_SIZE)
      ctx.lineTo(MP_CANVAS_WIDTH, y * CELL_SIZE)
      ctx.stroke()
    }

    // Draw food
    ctx.fillStyle = MP_COLORS.food
    for (const f of foodItems) {
      ctx.fillRect(
        f.x * CELL_SIZE + 1,
        f.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      )
    }

    // Draw Player 1 snake (with flash effect if hungry)
    const p1Alpha = p1ShouldFlash ? (Math.sin(now / 100) * 0.3 + 0.7) : 1
    ctx.fillStyle = MP_COLORS.player1
    ctx.globalAlpha = player1.isAlive ? p1Alpha : 0.3
    for (const segment of snake1) {
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      )
    }

    // Draw Player 2 snake (with flash effect if hungry)
    const p2Alpha = p2ShouldFlash ? (Math.sin(now / 100) * 0.3 + 0.7) : 1
    ctx.fillStyle = MP_COLORS.player2
    ctx.globalAlpha = player2.isAlive ? p2Alpha : 0.3
    for (const segment of snake2) {
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      )
    }

    ctx.globalAlpha = 1
  }, [getPlayer1Snake, getPlayer2Snake, getFood, player1.isAlive, player2.isAlive, p1ShouldFlash, p2ShouldFlash])

  // Animation loop for rendering
  useEffect(() => {
    let animationId: number

    const loop = () => {
      render()
      animationId = requestAnimationFrame(loop)
    }

    animationId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [render])

  // Handle rematch
  const handleRematch = useCallback(() => {
    setGameOverState(null)
    resetGame()
  }, [resetGame])

  // Get hunger bar color
  const getHungerColor = (percent: number): string => {
    if (percent > 0.66) return MP_COLORS.hungerGreen
    if (percent > 0.33) return MP_COLORS.hungerYellow
    return MP_COLORS.hungerRed
  }

  // Get latency indicator
  const getLatencyIndicator = (): { color: string; label: string } => {
    if (latency < 50) return { color: '#33ff33', label: '●' }
    if (latency < 100) return { color: '#ffff33', label: '●' }
    return { color: '#ff3333', label: '●' }
  }

  // Determine winner text
  const getWinnerText = (): string => {
    if (!gameOverState) return ''
    const { winner } = gameOverState
    if (winner === 'draw') return 'DRAW!'
    if (winner === playerId) return 'YOU WIN!'
    return 'YOU LOSE!'
  }

  // Show ready room if in ready phase
  if (status === 'ready' || status === 'countdown') {
    return (
      <ReadyRoom
        isHost={isHost}
        localReady={localReady}
        remoteReady={remoteReady}
        countdown={countdown}
        onReady={setLocalReady}
        onLeave={onDisconnect}
      />
    )
  }

  return (
    <div className="mp-game-container">
      {/* HUD */}
      <div className="mp-hud">
        {/* Latency indicator (hidden by default) */}
        {showLatency && (
          <div className="mp-latency" style={{ color: getLatencyIndicator().color }}>
            PING: {latency}ms {getLatencyIndicator().label}
          </div>
        )}

        <div className="mp-hud-row">
          {/* Player 1 score and hunger */}
          <div className="mp-player-stats mp-player-1">
            <div className="mp-score" style={{ color: MP_COLORS.player1 }}>
              P1: {player1.score}
            </div>
            <div className="mp-hunger-bar">
              <div
                className="mp-hunger-fill"
                style={{
                  width: `${p1HungerPercent * 100}%`,
                  backgroundColor: getHungerColor(p1HungerPercent),
                }}
              />
            </div>
          </div>

          {/* Level */}
          <div className={`mp-level level-${level}`}>
            LEVEL {level}
          </div>

          {/* Player 2 score and hunger */}
          <div className="mp-player-stats mp-player-2">
            <div className="mp-score" style={{ color: MP_COLORS.player2 }}>
              P2: {player2.score}
            </div>
            <div className="mp-hunger-bar">
              <div
                className="mp-hunger-fill"
                style={{
                  width: `${p2HungerPercent * 100}%`,
                  backgroundColor: getHungerColor(p2HungerPercent),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="mp-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={MP_CANVAS_WIDTH}
          height={MP_CANVAS_HEIGHT}
        />

        {/* Game Over Overlay */}
        {status === 'gameover' && gameOverState && (
          <div className="mp-overlay">
            <div className={`mp-winner-text ${gameOverState.winner === playerId ? 'winner' : gameOverState.winner === 'draw' ? 'draw' : 'loser'}`}>
              {getWinnerText()}
            </div>

            <div className="mp-final-scores">
              <span style={{ color: MP_COLORS.player1 }}>P1: {gameOverState.p1Score}</span>
              <span className="mp-score-divider">|</span>
              <span style={{ color: MP_COLORS.player2 }}>P2: {gameOverState.p2Score}</span>
            </div>

            <div className="mp-gameover-buttons">
              <button className="mp-button mp-rematch-button" onClick={handleRematch}>
                REMATCH
              </button>
              <button className="mp-button mp-menu-button" onClick={onGameEnd}>
                MAIN MENU
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MultiplayerGame

// Export the handleMessage handler type for parent component
export type { NetworkMessage }
