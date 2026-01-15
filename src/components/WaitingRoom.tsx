import { useState, useCallback } from 'react'

interface WaitingRoomProps {
  shareableLink: string
  onCancel: () => void
}

const WaitingRoom = ({ shareableLink, onCancel }: WaitingRoomProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareableLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = shareableLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareableLink])

  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <h1 className="waiting-title">WAITING FOR OPPONENT</h1>

        <div className="waiting-link-section">
          <p className="waiting-label">Share this link with your friend:</p>
          
          <div className="waiting-link-container">
            <input
              type="text"
              className="waiting-link-input"
              value={shareableLink}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              className="waiting-copy-button"
              onClick={handleCopyLink}
            >
              {copied ? 'COPIED!' : 'COPY'}
            </button>
          </div>
        </div>

        <div className="waiting-status">
          <div className="waiting-spinner"></div>
          <p>Waiting for opponent to connect...</p>
        </div>

        <button
          className="waiting-cancel-button"
          onClick={onCancel}
        >
          CANCEL
        </button>

        <div className="waiting-tip">
          <p>Tip: Press <kbd>Esc</kbd> to cancel</p>
        </div>
      </div>
    </div>
  )
}

export default WaitingRoom
