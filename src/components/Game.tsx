import { useRef, useEffect, useCallback } from 'react'
import { useGameLoop } from '../hooks/useGameLoop'
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  COLORS,
} from '../constants'

const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    score,
    level,
    highScore,
    status,
    isNewHighScore,
    startGame,
    getSnake,
    getFood,
  } = useGameLoop()

  /**
   * Render the game to canvas
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid lines
    ctx.strokeStyle = COLORS.gridLine
    ctx.lineWidth = 1

    // Vertical lines
    for (let x = 0; x <= GRID_WIDTH; x++) {
      ctx.beginPath()
      ctx.moveTo(x * CELL_SIZE, 0)
      ctx.lineTo(x * CELL_SIZE, CANVAS_HEIGHT)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * CELL_SIZE)
      ctx.lineTo(CANVAS_WIDTH, y * CELL_SIZE)
      ctx.stroke()
    }

    // Draw snake
    const snake = getSnake()
    ctx.fillStyle = COLORS.snake
    for (const segment of snake) {
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      )
    }

    // Draw food
    const food = getFood()
    ctx.fillStyle = COLORS.food
    ctx.fillRect(
      food.x * CELL_SIZE + 1,
      food.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2
    )
  }, [getSnake, getFood])

  /**
   * Animation loop for rendering
   */
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

  /**
   * Check for canvas support
   */
  const canvasSupported = typeof HTMLCanvasElement !== 'undefined'

  if (!canvasSupported) {
    return (
      <div className="game-container">
        <div className="overlay">
          <div className="overlay-title">ERROR</div>
          <div className="overlay-subtitle">Canvas not supported in this browser</div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-container">
      {/* HUD */}
      <div className="hud">
        <div className="hud-item">
          <span className="hud-label">SCORE</span>
          <span>{score}</span>
        </div>
        <div className={`hud-item hud-level level-${level}`}>
          <span className="hud-label">LEVEL</span>
          <span className="level-value">{level}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">HIGH</span>
          <span>{highScore}</span>
        </div>
      </div>

      {/* Canvas wrapper with overlays */}
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
        />

        {/* Start Screen Overlay */}
        {status === 'start' && (
          <div className="overlay">
            <div className="overlay-title">SNAKE</div>
            <div className="overlay-subtitle">
              Press any arrow key or Space to start
            </div>
            {highScore > 0 && (
              <div className="overlay-score">
                High Score: {highScore}
              </div>
            )}
            <button
              className="play-button"
              onClick={startGame}
            >
              START
            </button>
          </div>
        )}

        {/* Pause Overlay */}
        {status === 'paused' && (
          <div className="overlay">
            <div className="overlay-title">PAUSED</div>
            <div className="overlay-subtitle">
              Press Space to continue
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {status === 'gameover' && (
          <div className="overlay">
            <div className="overlay-title">GAME OVER</div>
            <div className="overlay-score">
              Score: {score}
            </div>
            {isNewHighScore ? (
              <div className="overlay-score new-highscore">
                NEW HIGH SCORE!
              </div>
            ) : (
              <div className="overlay-score">
                High Score: {highScore}
              </div>
            )}
            <button
              className="play-button"
              onClick={startGame}
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Game
