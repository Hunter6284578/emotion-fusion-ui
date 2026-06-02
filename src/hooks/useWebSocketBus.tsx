import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { getWebSocketURL } from '../api'
import type { FusedStreamPacket, WSConnectionState } from '../types'

interface WebSocketContextType {
  connectionState: WSConnectionState
  lastPacket: FusedStreamPacket | null
  connect: () => void
  disconnect: () => void
  sendVideo: (blob: Blob, timestamp: number, windowIndex: number) => void
  sendAudio: (blob: Blob, timestamp: number, windowIndex: number) => void
  sendEEG: (data: number[][], timestamp: number, channels?: string[], impedance?: number[]) => void
  sendGSR: (data: number[], timestamp: number) => void
  sendJSON: (data: any) => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<WSConnectionState>('disconnected')
  const [lastPacket, setLastPacket] = useState<FusedStreamPacket | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const isIntentionalDisconnectRef = useRef<boolean>(false)

  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionState('disconnected')
    setLastPacket(null)
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    isIntentionalDisconnectRef.current = false
    setConnectionState('connecting')
    
    try {
      const url = getWebSocketURL()
      console.log('[WebSocket] Connecting to:', url)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setConnectionState('connected')
      }

      ws.onmessage = (event) => {
        try {
          const packet: FusedStreamPacket = JSON.parse(event.data)
          // console.log('[WebSocket] Received packet:', packet)
          setLastPacket(packet)
        } catch (err) {
          console.error('[WebSocket] Error parsing downstream packet:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        setConnectionState('error')
      }

      ws.onclose = (event) => {
        console.log(`[WebSocket] Closed (code: ${event.code})`)
        wsRef.current = null
        
        // If not intentional, attempt auto-reconnect after 3 seconds
        if (!isIntentionalDisconnectRef.current) {
          setConnectionState('connecting')
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect()
          }, 3000)
        } else {
          setConnectionState('disconnected')
        }
      }
    } catch (err) {
      console.error('[WebSocket] Connection initialization failed:', err)
      setConnectionState('error')
    }
  }, [])

  const sendVideo = useCallback((blob: Blob, timestamp: number, windowIndex: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Video frame discarded, WS not open')
      return
    }
    
    // Protocol: text header frame then binary frame
    ws.send(JSON.stringify({
      type: 'video',
      client_timestamp: timestamp,
      window_index: windowIndex
    }))
    ws.send(blob)
  }, [])

  const sendAudio = useCallback((blob: Blob, timestamp: number, windowIndex: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Audio frame discarded, WS not open')
      return
    }

    // Protocol: text header frame then binary frame
    ws.send(JSON.stringify({
      type: 'audio',
      client_timestamp: timestamp,
      window_index: windowIndex
    }))
    ws.send(blob)
  }, [])

  const sendEEG = useCallback((data: number[][], timestamp: number, channels?: string[], impedance?: number[]) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type: 'eeg',
      client_timestamp: timestamp,
      data,
      channels,
      impedance
    }))
  }, [])

  const sendGSR = useCallback((data: number[], timestamp: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type: 'gsr',
      client_timestamp: timestamp,
      data
    }))
  }, [])

  const sendJSON = useCallback((data: any) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(data))
  }, [])

  useEffect(() => {
    return () => {
      isIntentionalDisconnectRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{
      connectionState,
      lastPacket,
      connect,
      disconnect,
      sendVideo,
      sendAudio,
      sendEEG,
      sendGSR,
      sendJSON
    }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}
