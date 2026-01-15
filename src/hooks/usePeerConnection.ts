import { useRef, useState, useCallback, useEffect } from 'react'
import Peer, { DataConnection } from 'peerjs'
import { 
  ConnectionStatus, 
  NetworkMessage,
  PlayerId 
} from '../types'
import { 
  CONNECTION_TIMEOUT_MS, 
  MAX_MESSAGES_PER_SECOND,
  MAX_MESSAGE_SIZE_BYTES 
} from '../constants'
import { generatePeerId } from '../utils/random'

interface UsePeerConnectionOptions {
  onMessage: (message: NetworkMessage) => void
  onConnected: () => void
  onDisconnected: (reason: string) => void
  onError: (error: string) => void
}

interface UsePeerConnectionReturn {
  // State
  status: ConnectionStatus
  peerId: string | null
  isHost: boolean
  latency: number
  
  // Actions
  hostGame: () => Promise<string>
  joinGame: (hostPeerId: string) => Promise<void>
  sendMessage: (message: NetworkMessage) => void
  disconnect: () => void
  
  // For link sharing
  getShareableLink: () => string
}

/**
 * Hook for managing PeerJS WebRTC connections.
 * Handles hosting and joining games, message passing, and connection lifecycle.
 */
export function usePeerConnection(options: UsePeerConnectionOptions): UsePeerConnectionReturn {
  const { onMessage, onConnected, onDisconnected, onError } = options
  
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [peerId, setPeerId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [latency, setLatency] = useState(0)
  
  // Refs for mutable state
  const peerRef = useRef<Peer | null>(null)
  const connectionRef = useRef<DataConnection | null>(null)
  const messageCountRef = useRef({ count: 0, timestamp: Date.now() })
  const pingIntervalRef = useRef<number | null>(null)
  const lastPingRef = useRef<number>(0)
  
  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now()
    const elapsed = now - messageCountRef.current.timestamp
    
    if (elapsed >= 1000) {
      // Reset counter every second
      messageCountRef.current = { count: 1, timestamp: now }
      return true
    }
    
    if (messageCountRef.current.count >= MAX_MESSAGES_PER_SECOND) {
      console.warn('Rate limit exceeded')
      return false
    }
    
    messageCountRef.current.count++
    return true
  }, [])
  
  // Send a message to the peer
  const sendMessage = useCallback((message: NetworkMessage) => {
    const conn = connectionRef.current
    if (!conn || conn.open !== true) {
      console.warn('Cannot send message: connection not open')
      return
    }
    
    const data = JSON.stringify(message)
    if (data.length > MAX_MESSAGE_SIZE_BYTES) {
      console.warn('Message too large:', data.length, 'bytes')
      return
    }
    
    conn.send(data)
  }, [])
  
  // Handle incoming messages
  const handleMessage = useCallback((data: unknown) => {
    if (!checkRateLimit()) return
    
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data
      
      // Handle ping/pong for latency measurement
      if (message.type === 'ping') {
        sendMessage({ type: 'pong', timestamp: message.timestamp })
        return
      }
      
      if (message.type === 'pong') {
        const rtt = Date.now() - message.timestamp
        setLatency(rtt)
        return
      }
      
      onMessage(message as NetworkMessage)
    } catch (e) {
      console.warn('Failed to parse message:', e)
    }
  }, [checkRateLimit, onMessage, sendMessage])
  
  // Set up connection event handlers
  const setupConnection = useCallback((conn: DataConnection) => {
    connectionRef.current = conn
    
    conn.on('open', () => {
      setStatus('connected')
      onConnected()
      
      // Start ping interval for latency measurement
      pingIntervalRef.current = window.setInterval(() => {
        lastPingRef.current = Date.now()
        sendMessage({ type: 'ping', timestamp: lastPingRef.current })
      }, 2000)
    })
    
    conn.on('data', handleMessage)
    
    conn.on('close', () => {
      setStatus('disconnected')
      onDisconnected('Connection closed')
      cleanup()
    })
    
    conn.on('error', (err) => {
      console.error('Connection error:', err)
      onError(err.message || 'Connection error')
    })
  }, [handleMessage, onConnected, onDisconnected, onError, sendMessage])
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    
    if (connectionRef.current) {
      connectionRef.current.close()
      connectionRef.current = null
    }
    
    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
    }
    
    setStatus('disconnected')
    setPeerId(null)
    setIsHost(false)
  }, [])
  
  // Host a new game
  const hostGame = useCallback(async (): Promise<string> => {
    cleanup()
    
    const id = generatePeerId()
    console.log('[PeerJS] Creating host with ID:', id)
    
    return new Promise((resolve, reject) => {
      const peer = new Peer(id, {
        debug: 2, // Enable debug logging
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
          ]
        }
      })
      
      peerRef.current = peer
      
      const timeout = setTimeout(() => {
        reject(new Error('Failed to connect to signaling server'))
        cleanup()
      }, CONNECTION_TIMEOUT_MS)
      
      peer.on('open', (openedId) => {
        console.log('[PeerJS] Host connected to signaling server, ID:', openedId)
        clearTimeout(timeout)
        setPeerId(openedId)
        setIsHost(true)
        setStatus('connecting') // Waiting for guest
        resolve(openedId)
      })
      
      peer.on('connection', (conn) => {
        console.log('[PeerJS] Guest is connecting:', conn.peer)
        // Guest is connecting
        setupConnection(conn)
      })
      
      peer.on('error', (err) => {
        clearTimeout(timeout)
        console.error('Peer error:', err)
        
        if (err.type === 'unavailable-id') {
          onError('Game ID already in use. Please try again.')
        } else if (err.type === 'peer-unavailable') {
          onError('Game not found. The host may have left.')
        } else if (err.type === 'network') {
          onError('Cannot connect to matchmaking server. Try again later.')
        } else {
          onError(err.message || 'Connection error')
        }
        
        setStatus('error')
        reject(err)
      })
      
      peer.on('disconnected', () => {
        // Lost connection to signaling server
        onDisconnected('Lost connection to server')
      })
    })
  }, [cleanup, onDisconnected, onError, setupConnection])
  
  // Join an existing game
  const joinGame = useCallback(async (hostPeerId: string): Promise<void> => {
    cleanup()
    
    // Validate peer ID format
    if (!hostPeerId.startsWith('snake-') || hostPeerId.length !== 22) {
      throw new Error('Invalid game link')
    }
    
    console.log('[PeerJS] Joining game with host ID:', hostPeerId)
    
    return new Promise((resolve, reject) => {
      const peer = new Peer({
        debug: 2, // Enable debug logging
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
          ]
        }
      })
      
      peerRef.current = peer
      setIsHost(false)
      setStatus('connecting')
      
      const timeout = setTimeout(() => {
        reject(new Error('Could not connect. Host may be unavailable.'))
        cleanup()
      }, CONNECTION_TIMEOUT_MS)
      
      peer.on('open', (myId) => {
        console.log('[PeerJS] Guest connected to signaling server, my ID:', myId)
        setPeerId(myId)
        
        // Connect to host
        console.log('[PeerJS] Attempting to connect to host:', hostPeerId)
        const conn = peer.connect(hostPeerId, { reliable: true })
        setupConnection(conn)
        
        // Wait for connection to open
        conn.on('open', () => {
          console.log('[PeerJS] Connection opened successfully!')
          clearTimeout(timeout)
          resolve()
        })
        
        conn.on('error', (err) => {
          console.error('[PeerJS] Connection error:', err)
          clearTimeout(timeout)
          reject(err)
        })
      })
      
      peer.on('error', (err) => {
        clearTimeout(timeout)
        console.error('[PeerJS] Peer error:', err)
        
        if (err.type === 'peer-unavailable') {
          onError('Game not found. The host may have left.')
        } else if (err.type === 'network') {
          onError('Cannot connect to matchmaking server. Try again later.')
        } else {
          onError(err.message || 'Connection error')
        }
        
        setStatus('error')
        reject(err)
      })
    })
  }, [cleanup, onError, setupConnection])
  
  // Disconnect from current game
  const disconnect = useCallback(() => {
    if (connectionRef.current?.open) {
      sendMessage({ type: 'disconnect', reason: 'User left' })
    }
    cleanup()
  }, [cleanup, sendMessage])
  
  // Get shareable link for the current game
  const getShareableLink = useCallback((): string => {
    if (!peerId || !isHost) return ''
    const url = new URL(window.location.href)
    url.searchParams.set('join', peerId)
    return url.toString()
  }, [peerId, isHost])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])
  
  return {
    status,
    peerId,
    isHost,
    latency,
    hostGame,
    joinGame,
    sendMessage,
    disconnect,
    getShareableLink,
  }
}

/**
 * Check if WebRTC is supported in the current browser
 */
export function isWebRTCSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined' 
      && typeof RTCDataChannel !== 'undefined'
}

/**
 * Extract peer ID from URL if present
 */
export function getPeerIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('join')
}
