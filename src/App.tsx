import { useState, useCallback, useEffect, useRef } from 'react'
import Game from './components/Game'
import MainMenu from './components/MainMenu'
import MultiplayerLobby from './components/MultiplayerLobby'
import WaitingRoom from './components/WaitingRoom'
import MultiplayerGame from './components/MultiplayerGame'
import { usePeerConnection, getPeerIdFromUrl } from './hooks/usePeerConnection'
import { AppScreen, NetworkMessage, PlayerId } from './types'

function App() {
  const [screen, setScreen] = useState<AppScreen>('menu')
  const [error, setError] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<PlayerId>('player1')
  
  // Ref for multiplayer game message handler
  const messageHandlerRef = useRef<((message: NetworkMessage) => void) | null>(null)

  // Handle network messages
  const handleMessage = useCallback((message: NetworkMessage) => {
    if (messageHandlerRef.current) {
      messageHandlerRef.current(message)
    }
  }, [])

  // Register message handler from MultiplayerGame
  const registerMessageHandler = useCallback((handler: (message: NetworkMessage) => void) => {
    messageHandlerRef.current = handler
  }, [])

  // Handle connection established
  const handleConnected = useCallback(() => {
    setScreen('multiplayer-ready')
    setError(null)
  }, [])

  // Handle disconnection
  const handleDisconnected = useCallback((reason: string) => {
    if (screen.startsWith('multiplayer')) {
      setError(`Disconnected: ${reason}`)
      setScreen('multiplayer-lobby')
    }
  }, [screen])

  // Handle connection error
  const handleError = useCallback((err: string) => {
    setError(err)
  }, [])

  // Peer connection hook
  const {
    status: connectionStatus,
    peerId,
    isHost,
    latency,
    hostGame,
    joinGame,
    sendMessage,
    disconnect,
    getShareableLink,
  } = usePeerConnection({
    onMessage: handleMessage,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onError: handleError,
  })

  // Check for join link on mount
  useEffect(() => {
    const joinPeerId = getPeerIdFromUrl()
    if (joinPeerId) {
      // Clear the URL parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('join')
      window.history.replaceState({}, '', url.toString())
      
      // Auto-join the game
      setPlayerId('player2')
      setScreen('multiplayer-connecting')
      joinGame(joinPeerId).catch((err) => {
        setError(err.message || 'Failed to connect')
        setScreen('multiplayer-lobby')
      })
    }
  }, [joinGame])

  // Handle screen navigation
  const handleSinglePlayer = useCallback(() => {
    setScreen('single-player')
  }, [])

  const handleMultiplayer = useCallback(() => {
    setScreen('multiplayer-lobby')
    setError(null)
  }, [])

  const handleBackToMenu = useCallback(() => {
    disconnect()
    setScreen('menu')
    setError(null)
  }, [disconnect])

  const handleCreateGame = useCallback(async () => {
    try {
      setError(null)
      setPlayerId('player1')
      await hostGame()
      setScreen('multiplayer-waiting')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game')
    }
  }, [hostGame])

  const handleJoinGame = useCallback(async (input: string) => {
    try {
      setError(null)
      setPlayerId('player2')
      
      // Extract peer ID from URL or use as-is
      let targetPeerId = input
      if (input.includes('?join=')) {
        const url = new URL(input)
        targetPeerId = url.searchParams.get('join') || input
      }
      
      setScreen('multiplayer-connecting')
      await joinGame(targetPeerId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game')
      setScreen('multiplayer-lobby')
    }
  }, [joinGame])

  const handleCancelWaiting = useCallback(() => {
    disconnect()
    setScreen('multiplayer-lobby')
  }, [disconnect])

  const handleDisconnect = useCallback(() => {
    disconnect()
    setScreen('multiplayer-lobby')
    setError(null)
  }, [disconnect])

  const handleGameEnd = useCallback(() => {
    disconnect()
    setScreen('menu')
  }, [disconnect])

  // Handle escape key globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (screen === 'multiplayer-waiting') {
          handleCancelWaiting()
        } else if (screen === 'single-player') {
          // Let the Game component handle its own escape
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [screen, handleCancelWaiting])

  // Render based on current screen
  switch (screen) {
    case 'menu':
      return (
        <MainMenu
          onSinglePlayer={handleSinglePlayer}
          onMultiplayer={handleMultiplayer}
        />
      )

    case 'single-player':
      return <Game />

    case 'multiplayer-lobby':
      return (
        <MultiplayerLobby
          onBack={handleBackToMenu}
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          connectionStatus={connectionStatus}
          error={error}
        />
      )

    case 'multiplayer-waiting':
      return (
        <WaitingRoom
          shareableLink={getShareableLink()}
          onCancel={handleCancelWaiting}
        />
      )

    case 'multiplayer-connecting':
      return (
        <div className="connecting-screen">
          <div className="connecting-content">
            <h1>CONNECTING...</h1>
            <div className="connecting-spinner"></div>
            {error && <div className="connecting-error">{error}</div>}
          </div>
        </div>
      )

    case 'multiplayer-ready':
    case 'multiplayer-playing':
    case 'multiplayer-gameover':
      return (
        <MultiplayerGame
          isHost={isHost}
          playerId={playerId}
          onGameEnd={handleGameEnd}
          onDisconnect={handleDisconnect}
          sendMessage={sendMessage}
          latency={latency}
          registerMessageHandler={registerMessageHandler}
        />
      )

    default:
      return <MainMenu onSinglePlayer={handleSinglePlayer} onMultiplayer={handleMultiplayer} />
  }
}

export default App
