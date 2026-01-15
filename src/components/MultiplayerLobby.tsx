import { useState, useCallback } from 'react'
import { ConnectionStatus } from '../types'

interface MultiplayerLobbyProps {
  onBack: () => void
  onCreateGame: () => void
  onJoinGame: (peerId: string) => void
  connectionStatus: ConnectionStatus
  error: string | null
}

const MultiplayerLobby = ({
  onBack,
  onCreateGame,
  onJoinGame,
  connectionStatus,
  error,
}: MultiplayerLobbyProps) => {
  const [joinCode, setJoinCode] = useState('')
  const [showJoinInput, setShowJoinInput] = useState(false)

  const handleJoinSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (joinCode.trim()) {
      onJoinGame(joinCode.trim())
    }
  }, [joinCode, onJoinGame])

  const isConnecting = connectionStatus === 'connecting'

  return (
    <div className="multiplayer-lobby">
      <div className="lobby-content">
        <h1 className="lobby-title">MULTIPLAYER</h1>

        {error && (
          <div className="lobby-error">
            {error}
          </div>
        )}

        {!showJoinInput ? (
          <div className="lobby-buttons">
            <button
              className="lobby-button lobby-button-create"
              onClick={onCreateGame}
              disabled={isConnecting}
            >
              {isConnecting ? 'CREATING...' : 'CREATE GAME'}
            </button>

            <button
              className="lobby-button lobby-button-join"
              onClick={() => setShowJoinInput(true)}
              disabled={isConnecting}
            >
              JOIN GAME
            </button>

            <button
              className="lobby-button lobby-button-back"
              onClick={onBack}
              disabled={isConnecting}
            >
              BACK
            </button>
          </div>
        ) : (
          <form className="join-form" onSubmit={handleJoinSubmit}>
            <label className="join-label">
              Enter game code or paste link:
            </label>
            <input
              type="text"
              className="join-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="snake-xxxxxxxxxxxx"
              autoFocus
              disabled={isConnecting}
            />
            <div className="join-buttons">
              <button
                type="submit"
                className="lobby-button"
                disabled={!joinCode.trim() || isConnecting}
              >
                {isConnecting ? 'CONNECTING...' : 'JOIN'}
              </button>
              <button
                type="button"
                className="lobby-button lobby-button-back"
                onClick={() => {
                  setShowJoinInput(false)
                  setJoinCode('')
                }}
                disabled={isConnecting}
              >
                CANCEL
              </button>
            </div>
          </form>
        )}

        <div className="lobby-info">
          <p>Create a game to host, or join using a friend's link.</p>
        </div>
      </div>
    </div>
  )
}

export default MultiplayerLobby
