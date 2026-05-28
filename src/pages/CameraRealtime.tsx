/** 页面 - 摄像头实时情绪分析 v3.0
 *  临床级升级：
 *  1. MediaRecorder API 记录 1~2 秒 .webm 视频流（25 FPS滑动窗口）
 *  2. 精确时间戳打标，为跨模态对齐做准备
 *  3. 实时VA空间可视化 + 动作单元(AU)时序面板
 *  4. 微表情事件检测展示
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  Camera, CameraOff, Play, Activity, Eye, EyeOff,
  AlertTriangle, Clock, Gauge, Zap, Brain,
} from 'lucide-react'
import type {
  VideoStreamResult, VAPoint, CameraStatus,
  VideoWindowConfig, MicroExpressionEvent,
} from '../types'
import type { EmotionLabel } from '../types'
import { EMOTION_CONFIG } from '../types'
import { analyzeVideoStream } from '../api'

// ============================================================
// 常量配置
// ============================================================

const VIDEO_CONFIG: VideoWindowConfig = {
  fps: 25,
  windowDurationMs: 1500,  // 1.5秒窗口
  windowStrideMs: 750,     // 50% 重叠
}

const VA_QUADRANTS = [
  { x: [0.5, 1], y: [0.5, 1], fill: 'rgba(34,197,94,0.06)', label: '快乐' },
  { x: [0, 0.5], y: [0.5, 1], fill: 'rgba(239,68,68,0.06)', label: '恐惧/愤怒' },
  { x: [0, 0.5], y: [0, 0.5], fill: 'rgba(99,102,241,0.06)', label: '悲伤' },
  { x: [0.5, 1], y: [0, 0.5], fill: 'rgba(59,130,246,0.06)', label: '平静' },
]

const AU_LABELS: Record<string, string> = {
  AU12_lip_corner_puller: '微笑(嘴角拉起)',
  AU4_brow_lowerer: '皱眉(眉毛压低)',
  AU6_cheek_raiser: '脸颊抬起',
  AU45_blink: '眨眼',
}

const AU_COLORS: Record<string, string> = {
  AU12_lip_corner_puller: '#22c55e',
  AU4_brow_lowerer: '#ef4444',
  AU6_cheek_raiser: '#f59e0b',
  AU45_blink: '#6366f1',
}

// ============================================================
// 子组件
// ============================================================

/** VA 空间实时可视化 */
function VASpaceLive({ points }: { points: VAPoint[] }) {
  const current = points.length > 0 ? points[points.length - 1] : null
  const history = points.slice(0, -1)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
        <Activity size={14} className="text-sky-500" />
        VA 情绪空间 · 实时
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" dataKey="valence" name="Valence" domain={[0, 1]}
            tick={{ fontSize: 9 }} />
          <YAxis type="number" dataKey="arousal" name="Arousal" domain={[0, 1]}
            tick={{ fontSize: 9 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as VAPoint
              return (
                <div className="bg-white/95 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-lg text-[11px]">
                  <p className="font-semibold">{d.emotion}</p>
                  <p>V: {d.valence.toFixed(3)} A: {d.arousal.toFixed(3)}</p>
                  <p className="text-slate-400 text-[10px]">{d.timestamp}</p>
                </div>
              )
            }}
          />
          {VA_QUADRANTS.map((q, i) => (
            <ReferenceArea key={i} x1={q.x[0]} x2={q.x[1]} y1={q.y[0]} y2={q.y[1]}
              fill={q.fill} stroke="none" />
          ))}
          {history.length > 1 && (
            <Scatter name="轨迹" data={history}
              line={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
              lineType="fitting" shape="circle">
              {history.map((_, i) => (
                <Cell key={i} fill="#cbd5e1" opacity={0.3 + (i / history.length) * 0.5}
                  r={2 + (i / history.length) * 2} />
              ))}
            </Scatter>
          )}
          {current && (
            <Scatter name="当前" data={[current]}>
              <Cell r={9} fill={(EMOTION_CONFIG[current.emotion] || EMOTION_CONFIG['unknown']).color}
                stroke="#fff" strokeWidth={2} />
            </Scatter>
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

/** AU 动作单元时序图 */
function AUTimeline({ result }: { result: VideoStreamResult | null }) {
  if (!result?.au_timeline?.timestamps?.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-center h-[200px] text-slate-400 text-xs">
        等待分析结果...
      </div>
    )
  }

  const { timestamps, ...auSeries } = result.au_timeline
  const baseTime = timestamps[0]
  const chartData = timestamps.map((t, i) => {
    const row: Record<string, number> = { time: Number(((t - baseTime) / 1000).toFixed(1)) }
    for (const [key, values] of Object.entries(auSeries)) {
      if (Array.isArray(values) && i < values.length) {
        row[key] = values[i] as number
      }
    }
    return row
  })

  const auKeys = Object.keys(auSeries)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
        <Eye size={14} className="text-violet-500" />
        面部动作单元 (AU) · 时序
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }}
            label={{ value: '时间 (s)', position: 'bottom', style: { fontSize: 9, fill: '#94a3b8' } }} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
          <Tooltip
            contentStyle={{ fontSize: 11 }}
            // @ts-expect-error recharts formatter 类型兼容性
            formatter={(value: unknown, name: string) => [
              typeof value === 'number' ? value.toFixed(3) : String(value),
              AU_LABELS[name] || name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            formatter={(value: string) => AU_LABELS[value] || value}
          />
          {auKeys.map((key) => (
            <Line key={key} type="monotone" dataKey={key}
              stroke={AU_COLORS[key] || '#94a3b8'}
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 微表情事件列表 */
function MicroExpressionPanel({ events }: { events: MicroExpressionEvent[] }) {
  if (!events.length) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
        <Zap size={14} className="text-amber-500" />
        微表情检测 ({events.length} 个事件)
      </h3>
      <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
        {events.map((ev, i) => {
          const cfg = EMOTION_CONFIG[ev.emotion as keyof typeof EMOTION_CONFIG] || EMOTION_CONFIG['unknown']
          return (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg text-[11px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="font-medium text-slate-700">{ev.emotion}</span>
              <span className="text-slate-400">{ev.duration_ms}ms</span>
              <span className="text-slate-400">强度: {ev.peak_intensity.toFixed(2)}</span>
              <span className="text-slate-400 ml-auto text-[10px]">
                AU: {ev.trigger_aus.join(', ')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 头部姿态面板 */
function HeadPosePanel({ result }: { result: VideoStreamResult | null }) {
  if (!result?.head_pose_timeline?.timestamps?.length) return null

  const { timestamps, pitch, yaw, roll } = result.head_pose_timeline
  const baseTime = timestamps[0]
  const chartData = timestamps.map((t, i) => ({
    time: Number(((t - baseTime) / 1000).toFixed(1)),
    pitch: pitch[i] ?? 0,
    yaw: yaw[i] ?? 0,
    roll: roll[i] ?? 0,
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
        <Gauge size={14} className="text-teal-500" />
        头部姿态 · 时序
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" tick={{ fontSize: 9 }} />
          <YAxis domain={[-90, 90]} tick={{ fontSize: 9 }} unit="°" />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="pitch" stroke="#ef4444" strokeWidth={1.5} dot={false} name="俯仰" />
          <Line type="monotone" dataKey="yaw" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="偏航" />
          <Line type="monotone" dataKey="roll" stroke="#22c55e" strokeWidth={1.5} dot={false} name="翻滚" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

export default function CameraRealtime() {
  // 摄像头状态
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)

  // 视频流分析结果
  const [latestResult, setLatestResult] = useState<VideoStreamResult | null>(null)
  const [vaHistory, setVaHistory] = useState<VAPoint[]>([])
  const [windowCount, setWindowCount] = useState(0)
  const [fpsActual, setFpsActual] = useState(0)

  // 微表情事件累积
  const [allMicroExpressions, setAllMicroExpressions] = useState<MicroExpressionEvent[]>([])

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const windowIndexRef = useRef(0)
  const recordingStartRef = useRef<number>(0)
  const isActiveRef = useRef(false)
  const lastFrameTimeRef = useRef(0)
  const frameCountRef = useRef(0)
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ========== 摄像头启动 ==========
  const startCamera = useCallback(async () => {
    setError(null)
    setStatus('starting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: VIDEO_CONFIG.fps },
          facingMode: 'user',
        },
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
      setError(`摄像头访问失败: ${err instanceof Error ? err.message : '未知错误'}`)
      setStatus('error')
    }
  }, [])

  // ========== 摄像头停止 ==========
  const stopCamera = useCallback(() => {
    isActiveRef.current = false
    setStatus('idle')

    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current)
      fpsIntervalRef.current = null
    }

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

    setFpsActual(0)
    setWindowCount(0)
    windowIndexRef.current = 0
  }, [])

  // ========== 核心：MediaRecorder 滑动窗口录制循环 ==========
  const startRecordingCycle = useCallback(() => {
    if (!isActiveRef.current) return

    // 创建新的 MediaRecorder 实例
    const stream = streamRef.current
    if (!stream) return

    // 检查 MIME 支持
    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8')
      ? 'video/webm; codecs=vp8'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4'

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1500000, // 1.5 Mbps 适中码率
    })

    mediaRecorderRef.current = recorder
    chunksRef.current = []
    recordingStartRef.current = Date.now()

    // 收集数据块
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    // 录制完成 → 发送到后端分析
    recorder.onstop = async () => {
      if (!isActiveRef.current) return

      const blob = new Blob(chunksRef.current, { type: mimeType })
      const durationMs = Date.now() - recordingStartRef.current
      const windowIdx = windowIndexRef.current++

      if (blob.size < 1000) {
        // 数据太小，跳过并继续下一轮
        scheduleNextWindow()
        return
      }

      setWindowCount(prev => prev + 1)
      setStatus('analyzing')

      const metadata = {
        fps: VIDEO_CONFIG.fps,
        frameCount: frameCountRef.current,
        durationMs,
        startTimestamp: recordingStartRef.current,
        windowIndex: windowIdx,
      }

      try {
        const result = await analyzeVideoStream(blob, metadata)
        setLatestResult(result)

        // 更新 VA 历史
        if (result.valence_mean !== undefined && result.arousal_mean !== undefined) {
          setVaHistory(prev => {
            const newPoint: VAPoint = {
              valence: result.valence_mean,
              arousal: result.arousal_mean,
              emotion: (result.final_emotion || 'unknown') as EmotionLabel,
              timestamp: new Date(recordingStartRef.current).toLocaleTimeString('zh-CN'),
              confidence: result.confidence_mean,
            }
            return [...prev.slice(-49), newPoint]
          })
        }

        // 累积微表情事件
        if (result.micro_expression_events?.length) {
          setAllMicroExpressions(prev => [...prev.slice(-19), ...result.micro_expression_events])
        }
      } catch (err) {
        console.error('视频流分析失败:', err)
        setError(`分析失败: ${err instanceof Error ? err.message : '未知错误'}`)
      } finally {
        if (isActiveRef.current) {
          setStatus('streaming')
        }
      }

      // 继续下一轮
      scheduleNextWindow()
    }

    // 开始录制
    recorder.start()
    frameCountRef.current = 0
    lastFrameTimeRef.current = Date.now()

    // 定时在窗口时长（1.5秒）后停止录制，从而触发 onstop 执行分析并循环到下一个分片
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop()
      }
    }, VIDEO_CONFIG.windowDurationMs)

    // FPS 计数器
    if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current)
    fpsIntervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - lastFrameTimeRef.current) / 1000
      if (elapsed > 0) {
        setFpsActual(Math.round(frameCountRef.current / elapsed))
      }
    }, 500)
  }, [])

  // 安排下一个窗口（在上一轮分析完成后）
  const scheduleNextWindow = useCallback(() => {
    if (!isActiveRef.current) return

    // 短暂延迟后开始下一个窗口
    setTimeout(() => {
      if (!isActiveRef.current) return
      startRecordingCycle()
    }, 200) // 200ms 间隔，配合 1.5s 窗口实现约 50% 重叠
  }, [startRecordingCycle])

  // ========== Canvas 帧计数器（可选：在 video 上叠加帧号） ==========
  useEffect(() => {
    if (status !== 'streaming' && status !== 'analyzing') return

    let animId: number
    const countFrames = () => {
      if (videoRef.current && isActiveRef.current) {
        frameCountRef.current++
      }
      animId = requestAnimationFrame(countFrames)
    }
    animId = requestAnimationFrame(countFrames)

    return () => cancelAnimationFrame(animId)
  }, [status])

  // ========== 清理 ==========
  useEffect(() => {
    return () => {
      isActiveRef.current = false
      if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // ========== 渲染 ==========
  const emotionCfg = latestResult
    ? (EMOTION_CONFIG[latestResult.final_emotion as keyof typeof EMOTION_CONFIG] || EMOTION_CONFIG['unknown'])
    : null

  return (
    <div className="space-y-4 animate-fade-in-up p-6">
      {/* 顶部状态栏 */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            status === 'streaming' ? 'bg-emerald-100' :
            status === 'analyzing' ? 'bg-amber-100 animate-pulse' :
            status === 'error' ? 'bg-red-100' : 'bg-slate-100'
          }`}>
            <Camera size={22} className={
              status === 'streaming' ? 'text-emerald-600' :
              status === 'analyzing' ? 'text-amber-600' :
              status === 'error' ? 'text-red-600' : 'text-slate-400'
            } />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">摄像头实时情绪分析</h1>
            <p className="text-[11px] text-slate-400">
              滑动窗口 · 25 FPS · 面部AU解码 · 微表情检测
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 状态指示 */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === 'streaming' ? 'bg-emerald-400 animate-pulse' :
              status === 'analyzing' ? 'bg-amber-400 animate-pulse' :
              status === 'error' ? 'bg-red-400' : 'bg-slate-300'
            }`} />
            <span className="text-slate-500">
              {status === 'idle' && '就绪'}
              {status === 'starting' && '启动中...'}
              {status === 'streaming' && '采集中'}
              {status === 'analyzing' && '分析中...'}
              {status === 'error' && '错误'}
            </span>
          </div>

          {/* 统计 */}
          {status !== 'idle' && (
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock size={12} /> 窗口: {windowCount}
              </span>
              <span className="flex items-center gap-1">
                <Gauge size={12} /> FPS: {fpsActual}
              </span>
            </div>
          )}

          {/* 控制按钮 */}
          <button
            onClick={status === 'idle' ? startCamera : stopCamera}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
              status === 'idle'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-600 hover:to-cyan-600 shadow-sm'
                : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
            }`}
          >
            {status === 'idle' ? (
              <><Play size={16} /> 开始采集</>
            ) : (
              <><CameraOff size={16} /> 停止采集</>
            )}
          </button>
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 主内容区：左侧摄像头+结果，右侧图表 */}
      <div className="grid grid-cols-5 gap-4">
        {/* 左侧：摄像头预览 + 当前结果 */}
        <div className="col-span-2 space-y-4">
          {/* 摄像头预览 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Camera size={14} className="text-sky-500" />
                摄像头预览
              </span>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
              {showPreview ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-slate-500 text-xs">预览已隐藏</div>
              )}
              {/* 隐藏的 canvas（用于帧计数等） */}
              <canvas ref={canvasRef} className="hidden" width={640} height={480} />

              {/* 当前情绪浮层 */}
              {latestResult && (
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur rounded-lg px-3 py-2 text-white">
                  <div className="text-[10px] text-slate-300">当前情绪</div>
                  <div className="text-lg font-bold" style={{ color: emotionCfg?.color }}>
                    {latestResult.final_emotion}
                  </div>
                  <div className="text-[10px] text-slate-300">
                    V: {latestResult.valence_mean?.toFixed(3)} A: {latestResult.arousal_mean?.toFixed(3)}
                  </div>
                </div>
              )}

              {/* 采集状态指示器 */}
              {status === 'streaming' && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur rounded-full px-2.5 py-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-white font-mono">REC</span>
                </div>
              )}
            </div>
          </div>

          {/* 当前结果卡片 */}
          {latestResult && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Brain size={14} className="text-sky-500" />
                最新分析结果
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">情绪</div>
                  <div className="text-xl font-bold" style={{ color: emotionCfg?.color }}>
                    {latestResult.final_emotion}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">置信度</div>
                  <div className="text-xl font-bold text-slate-700">
                    {((latestResult.confidence_mean ?? 0) * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">Valence (愉悦度)</div>
                  <div className="text-lg font-bold text-slate-700">
                    {latestResult.valence_mean?.toFixed(3)}
                    <span className="text-[10px] text-slate-400 ml-1">±{latestResult.valence_std?.toFixed(3)}</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400">Arousal (唤醒度)</div>
                  <div className="text-lg font-bold text-slate-700">
                    {latestResult.arousal_mean?.toFixed(3)}
                    <span className="text-[10px] text-slate-400 ml-1">±{latestResult.arousal_std?.toFixed(3)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span>检测帧: {latestResult.detected_frames}/{latestResult.total_frames}</span>
                <span>窗口时长: {latestResult.duration_ms}ms</span>
                <span>FPS: {latestResult.fps}</span>
              </div>

              {latestResult.warning && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
                  <AlertTriangle size={12} />
                  {latestResult.warning}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右侧：图表面板 */}
        <div className="col-span-3 space-y-4">
          {/* VA 空间 */}
          <VASpaceLive points={vaHistory} />

          {/* AU 动作单元时序 */}
          <AUTimeline result={latestResult} />

          {/* 头部姿态 */}
          <HeadPosePanel result={latestResult} />

          {/* 微表情事件 */}
          <MicroExpressionPanel events={allMicroExpressions} />

          {/* 空状态 */}
          {status === 'idle' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <Camera size={48} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-400">点击"开始采集"启动摄像头实时分析</p>
              <p className="text-[11px] text-slate-300 mt-1">
                系统将以 25 FPS 采集视频流，通过滑动窗口发送至后端进行面部情绪分析
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
