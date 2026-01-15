interface ReadyRoomProps {
  isHost: boolean
  localReady: boolean
  remoteReady: boolean
  countdown: number | null
  onReady: (ready: boolean) => void
  onLeave: () => void
}

const ReadyRoom = ({
  isHost,
  localReady,
  remoteReady,
  countdown,
  onReady,
  onLeave,
}: ReadyRoomProps) => {
  const bothReady = localReady && remoteReady

  return (
    <div className="ready-room">
      <div className="ready-content">
        {countdown !== null ? (
          <div className="countdown-section">
            <h1 className="countdown-number">{countdown}</h1>
            <p className="countdown-text">Get ready!</p>
          </div>
        ) : (
          <>
            <h1 className="ready-title">
              {isHost ? 'PLAYER 2 JOINED!' : 'CONNECTED!'}
            </h1>

            <div className="ready-status-container">
              <div className={`ready-player ready-player-1 ${localReady ? 'ready' : ''}`}>
                <span className="ready-checkbox">
                  {localReady ? '✓' : '○'}
                </span>
                <span className="ready-player-label">
                  {isHost ? 'You (Host)' : 'You'}
                </span>
              </div>

              <div className={`ready-player ready-player-2 ${remoteReady ? 'ready' : ''}`}>
                <span className="ready-checkbox">
                  {remoteReady ? '✓' : '○'}
                </span>
                <span className="ready-player-label">
                  {isHost ? 'Opponent' : 'Host'}
                </span>
              </div>
            </div>

            <div className="ready-buttons">
              <button
                className={`ready-button ${localReady ? 'ready-button-unready' : 'ready-button-ready'}`}
                onClick={() => onReady(!localReady)}
              >
                {localReady ? 'NOT READY' : 'READY'}
              </button>

              <button
                className="ready-button ready-button-leave"
                onClick={onLeave}
              >
                LEAVE
              </button>
            </div>

            <div className="ready-tip">
              <p>Press <kbd>Space</kbd> to toggle ready</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ReadyRoom
