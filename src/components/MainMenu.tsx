import { useEffect, useState } from 'react'
import { getHighScore } from '../utils/storage'
import { isWebRTCSupported } from '../hooks/usePeerConnection'

interface MainMenuProps {
  onSinglePlayer: () => void
  onMultiplayer: () => void
}

const MainMenu = ({ onSinglePlayer, onMultiplayer }: MainMenuProps) => {
  const [highScore, setHighScore] = useState(0)
  const [webRTCSupported, setWebRTCSupported] = useState(true)

  useEffect(() => {
    setHighScore(getHighScore())
    setWebRTCSupported(isWebRTCSupported())
  }, [])

  return (
    <div className="main-menu">
      <div className="menu-content">
        <h1 className="menu-title">SNAKE</h1>
        
        <div className="menu-buttons">
          <button 
            className="menu-button" 
            onClick={onSinglePlayer}
          >
            SINGLE PLAYER
          </button>
          
          <button 
            className="menu-button menu-button-mp"
            onClick={onMultiplayer}
            disabled={!webRTCSupported}
            title={!webRTCSupported ? 'Multiplayer requires a modern browser with WebRTC support' : undefined}
          >
            MULTIPLAYER
          </button>
        </div>

        {highScore > 0 && (
          <div className="menu-highscore">
            High Score: {highScore}
          </div>
        )}

        {!webRTCSupported && (
          <div className="menu-warning">
            Multiplayer unavailable: WebRTC not supported
          </div>
        )}
      </div>
    </div>
  )
}

export default MainMenu
