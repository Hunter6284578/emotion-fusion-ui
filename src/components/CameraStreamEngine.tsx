import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, CameraOff, Play, EyeOff, Eye } from 'lucide-react'
import type { VideoStreamResult, CameraStatus, VideoWindowConfig } from '../types'
import { analyzeVideoStream } from '../api'

const VIDEO_CONFIG: VideoWindowConfig = {
  fps: 25,
  windowDurationMs: 1500,  // 1.5s
  windowStrideMs: 750,
}

interface CameraStreamEngineProps {
  onAnalysisResult: (result: VideoStreamResult) => void;
}

export default function CameraStreamEngine({ onAnalysisResult }: CameraStreamEngineProps) {
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [showPreview, setShowPreview] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const windowIndexRef = useRef(0)
  const recordingStartRef = useRef<number>(0)
  const isActiveRef = useRef(false)
  const frameCountRef = useRef(0)

  const startCamera = useCallback(async () => {
    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: VIDEO_CONFIG.fps }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      isActiveRef.current = true
      setStatus('streaming')
      startRecordingCycle()
    } catch (err) {
      console.error('Camera error', err)
      setStatus('error')
    }
  }, [])

  const stopCamera = useCallback(() => {
    isActiveRef.current = false
    setStatus('idle')

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    windowIndexRef.current = 0
  }, [])

  const startRecordingCycle = useCallback(() => {
    if (!isActiveRef.current) return
    const stream = streamRef.current
    if (!stream) return

    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8')
      ? 'video/webm; codecs=vp8'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4'

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1500000 })
    mediaRecorderRef.current = recorder
    chunksRef.current = []
    recordingStartRef.current = Date.now()

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      if (!isActiveRef.current) return

      const blob = new Blob(chunksRef.current, { type: mimeType })
      const durationMs = Date.now() - recordingStartRef.current
      const windowIdx = windowIndexRef.current++
      const currentStartTs = recordingStartRef.current

      if (blob.size < 1000) {
        scheduleNextWindow()
        return
      }

      const metadata = {
        fps: VIDEO_CONFIG.fps,
        frameCount: frameCountRef.current,
        durationMs,
        startTimestamp: currentStartTs,
        windowIndex: windowIdx,
      }

      try {
        const result = await analyzeVideoStream(blob, metadata)
        // Important: ensure result has the start_timestamp we recorded when it started
        result.start_timestamp = currentStartTs
        onAnalysisResult(result)
      } catch (err) {
        console.error('Video analysis failed:', err)
      }

      scheduleNextWindow()
    }

    recorder.start()
    frameCountRef.current = 0

    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop()
      }
    }, VIDEO_CONFIG.windowDurationMs)
  }, [onAnalysisResult])

  const scheduleNextWindow = useCallback(() => {
    if (!isActiveRef.current) return
    setTimeout(() => {
      if (!isActiveRef.current) return
      startRecordingCycle()
    }, 200)
  }, [startRecordingCycle])

  useEffect(() => {
    if (status !== 'streaming') return
    let animId: number
    const countFrames = () => {
      if (videoRef.current && isActiveRef.current) frameCountRef.current++
      animId = requestAnimationFrame(countFrames)
    }
    animId = requestAnimationFrame(countFrames)
    return () => cancelAnimationFrame(animId)
  }, [status])

  useEffect(() => {
    return () => {
      isActiveRef.current = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
          <Camera size={14} className="text-teal-500" />
          静默视觉观察
        </span>
        <div className="flex items-center gap-2">
          {status === 'streaming' && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
          <button onClick={() => setShowPreview(!showPreview)} className="text-slate-400 hover:text-slate-600 transition-colors">
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      
      <div className="relative bg-slate-900 aspect-video flex items-center justify-center overflow-hidden">
        {showPreview ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-500 ${status === 'streaming' ? 'opacity-80 grayscale-[20%]' : 'opacity-100'}`}
          />
        ) : (
          <div className="text-slate-500 text-[11px]">预览已折叠，后台采集中</div>
        )}
      </div>

      <div className="p-3 bg-white">
        <button
          onClick={status === 'idle' ? startCamera : stopCamera}
          className={`w-full py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all ${
            status === 'idle'
              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
              : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
          }`}
        >
          {status === 'idle' ? <><Play size={14} /> 开启全流采集</> : <><CameraOff size={14} /> 停止观察</>}
        </button>
      </div>
    </div>
  )
}
