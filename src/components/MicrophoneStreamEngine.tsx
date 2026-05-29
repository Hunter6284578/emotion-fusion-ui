import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocketBus'

const AUDIO_WINDOW_MS = 1500 // 1.5s chunks

interface MicrophoneStreamEngineProps {
  isSessionActive: boolean
}

export default function MicrophoneStreamEngine({ isSessionActive }: MicrophoneStreamEngineProps) {
  const { sendAudio, connectionState } = useWebSocket()
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const windowIndexRef = useRef(0)
  const recordingStartRef = useRef<number>(0)
  const isActiveRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      streamRef.current = stream
      isActiveRef.current = true
      setIsRecording(true)

      // Set up AudioContext for real-time wave animation
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        const audioCtx = new AudioContextClass()
        audioContextRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 64
        source.connect(analyser)
        analyserRef.current = analyser

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const updateLevel = () => {
          if (!isActiveRef.current || !analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          
          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i]
          }
          const average = sum / bufferLength
          // Normalize to [0, 100] for visual styling
          setAudioLevel(Math.min(100, Math.round((average / 255) * 100 * 1.5)))
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
        
        animationFrameRef.current = requestAnimationFrame(updateLevel)
      } catch (err) {
        console.error('Audio level visualization setup failed:', err)
      }

      startRecordingCycle()
    } catch (err) {
      console.error('Microphone access failed:', err)
      setIsRecording(false)
    }
  }, [sendAudio])

  const stopAudio = useCallback(() => {
    isActiveRef.current = false
    setIsRecording(false)
    setAudioLevel(0)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    
    windowIndexRef.current = 0
  }, [])

  const startRecordingCycle = useCallback(() => {
    if (!isActiveRef.current) return
    const stream = streamRef.current
    if (!stream) return

    const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
      ? 'audio/webm; codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder
    chunksRef.current = []
    recordingStartRef.current = Date.now()

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      if (!isActiveRef.current) return

      const blob = new Blob(chunksRef.current, { type: mimeType })
      const windowIdx = windowIndexRef.current++
      const currentStartTs = recordingStartRef.current

      if (blob.size > 100) {
        // Send via WebSocket context
        sendAudio(blob, currentStartTs, windowIdx)
      }

      // Schedule next window
      setTimeout(() => {
        if (!isActiveRef.current) return
        startRecordingCycle()
      }, 50)
    }

    recorder.start()

    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop()
      }
    }, AUDIO_WINDOW_MS)
  }, [sendAudio])

  useEffect(() => {
    if (isSessionActive) {
      startAudio()
    } else {
      stopAudio()
    }
  }, [isSessionActive, startAudio, stopAudio])

  useEffect(() => {
    return () => {
      isActiveRef.current = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
          <Mic size={14} className="text-blue-500" />
          双声道语音捕获
        </span>
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col items-center justify-center bg-slate-900 aspect-[21/9] relative overflow-hidden">
        {isRecording ? (
          <div className="flex items-center justify-center gap-1 h-12 w-full px-8">
            {[...Array(9)].map((_, i) => {
              // Calculate dynamic height based on volume level and index
              const baseHeight = 4
              const factor = 1 - Math.abs(i - 4) * 0.15
              const activeHeight = baseHeight + (audioLevel * 0.4) * factor
              const heightValue = isSessionActive ? `${Math.max(4, activeHeight)}px` : '4px'
              
              return (
                <div
                  key={i}
                  style={{ height: heightValue }}
                  className="w-1.5 bg-blue-400 rounded-full transition-all duration-75 ease-out"
                />
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-slate-500">
            <MicOff size={20} className="opacity-40" />
            <span className="text-[11px]">麦克风未激活</span>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Volume2 size={12} className="text-slate-400" />
          <span>输入电平: {isRecording ? `${audioLevel}%` : '0%'}</span>
        </div>
        <span>
          {connectionState === 'connected' && isRecording ? '实时音频特征提取中' : '未连接'}
        </span>
      </div>
    </div>
  )
}
